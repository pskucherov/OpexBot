const { mkDirByPathSync } = require('../utils');
const path = require('path');
const fs = require('fs');

try {
    class Common {
        constructor(accountId, adviser, backtest, callbacks = {
            subscribes: {},

            // TODO: порефакторить количество параметров
            postOrder: (accountId, figi, quantity, price, direction, orderType, orderId) => {}, // eslint-disable-line max-params
            cacheState: (figi, time, lastPrice, orderBook) => {},
        }, options = {
            enums: {},

            // takeProfit: 3,
            // stopLoss: 1,
            // useTrailingStop: true,
        }) {
            this.accountId = accountId;
            this.backtest = Boolean(backtest);
            this.enums = options.enums;

            // Методы, с помощью которых робот может общаться с внешним миром.
            this.cb = callbacks;

            // Автоматически переставлять stopLoss и takeProfit при движении цены в нужную сторону.
            // this.useTrailingStop = options.useTrailingStop;
            this.isSandbox = Boolean(options.isSandbox);

            (async () => {
                this.init();
                this.processing();
                this.initAsync();
            })();
        }

        init() {
            // Таймер подписки на события.
            this.subscribesTimer = 1500;

            // Таймер выполнения process
            this.robotTimer = 15000;
            this.subscribeDataUpdated = {};

            this.orders = {};

            // Устанавливает возможна ли торговля в данный момент.
            // Для бектеста всегда включено.
            this.tradingTime = Boolean(this.backtest);

            this.getCurrentSettings();
        }

        /**
         * Проверяет возможность торговли в данный день и время.
         */
        async checkTradingDayAndTime() {
            if (this.backtest) {
                this.tradingTime = true;
            }

            if (!this.tickerInfo || !this.exchange) {
                return;
            }

            const { isTradingDay, startTime, endTime } = this.exchange;
            const now = new Date().getTime();

            // TODO: добавить обновление данных при смене дня.
            if (!isTradingDay || !startTime || !endTime) {
                this.tradingTime = false;
            } else if ((new Date(startTime).getTime()) <= now && (new Date(endTime).getTime() > now)) {
                this.tradingTime = true;
            }
        }

        async initAsync() {
            this.updateOrders();
        }

        async updateOrders() {
            if (this.backtest) {
                return;
            }

            this.currentOrders = await this.getOpenOrders();

            // this.currentPositions = await this.getPositions();
            this.currentPortfolio = await this.getPortfolio();

            // this.currentOperations = await this.getOperations();

            this.ordersInited = true;
        }

        /**
         *
         * @param {?String} param
         * @returns
         */
        getParams(param) {
            if (param) {
                return this[param];
            }

            return {
                timer: this.timer,
            };
        }

        timer(time) {
            return new Promise(resolve => setTimeout(resolve, time));
        }

        subscribes() { // eslint-disable-line sonarjs/cognitive-complexity
            try {
                if (this.backtest) {
                    return;
                }
                const { subscribes } = this.cb;

                ['lastPrice', 'orderbook'].forEach(name => {
                    if (subscribes[name]) {
                        setImmediate(async () => {
                            const gen = subscribes[name][0]((async function* () {
                                while (this.inProgress) {
                                    await this.timer(this.subscribesTimer);
                                    yield subscribes[name][1]();
                                }
                            }).call(this));

                            for await (const data of gen) {
                                if (data[name]) {
                                    this.subscribeDataUpdated[name] = true;
                                    this[name] = name === 'lastPrice' ? data[name].price : data[name];
                                }
                                if (!this.inProgress) {
                                    break;
                                }
                            }
                        });
                    }
                });

                if (subscribes.orders && !this.isSandbox) {
                    setImmediate(async () => {
                        const gen = subscribes.orders({
                            accounts: [this.accountId],
                        });

                        for await (const data of gen) {
                            if (data.orderTrades) {
                                if (!this.orderTrades) {
                                    this.orderTrades = [];
                                }

                                this.orderTrades.push(data.orderTrades);
                                this.logOrders(data);
                                await this.updateOrders();
                            }

                            if (!this.inProgress) {
                                break;
                            }
                        }
                    });
                }
            } catch (e) { console.log(e) } // eslint-disable-line no-console
        }

        /**
         * Модуль обработки данных.
         * По сути бесконечный цикл, который обрабатывает входящие данные.
         */
        async processing() {
            if (!this.inProgress && !this.backtest) {
                setImmediate(() => this.processing());

                return;
            }

            if (!this.backtest) {
                await this.timer(this.robotTimer);
                await this.updateOrders();
                await this.checkTradingDayAndTime();
            }

            if (this.tradingTime) {
                this.getCurrentSettings();

                // Обрабатываем логику только после инициализации статуса.
                if (this.ordersInited || this.backtest) {
                    if (await this.decisionClosePosition()) {
                        // console.log('decisionClosePosition'); // eslint-disable-line no-console
                        await this.closePosition(this.lastPrice);
                    } else if (await this.decisionBuy()) {
                        // console.log('decisionBuy'); // eslint-disable-line no-console
                        await this.buy();
                    } else if (await this.decisionSell()) {
                        // console.log('decisionBuy'); // eslint-disable-line no-console
                        await this.sell();
                    }
                }

                // Записываем новое состояние, только если оно изминилось.
                if (!this.backtest && this.figi && this.cb.cacheState &&
                    (this.subscribeDataUpdated.orderbook && this.subscribeDataUpdated.lastPrice)) {
                    this.cb.cacheState(this.figi, new Date().getTime(), this.lastPrice, this.orderbook);
                    this.subscribeDataUpdated.lastPrice = false;
                    this.subscribeDataUpdated.orderbook = false;
                }
            }

            // Для бектестирования производится пошаговая обработка сделок,
            // а не рекурсивная.
            if (!this.backtest) {
                setImmediate(() => this.processing());
            }
        }

        /**
         * Модуль принятия решений о покупке.
         * @returns {Boolean}
         */
        decisionBuy() {
            return false;
        }

        /**
         * Модуль принятия решений о продаже.
         * @returns {Boolean}
         */
        decisionSell() {
            return false;
        }

        /**
         * Модуль принятия решений о закрытии существующей позиции.
         * @returns {Boolean}
         */
        decisionClosePosition() {
            return false;
        }

        setControlsCallbacks() {
            // Метод покупки
            // Продажи
            // Выставления заявки
        }

        async setCurrentState(lastPrice, candles, balance, orderbook, options) {
            // Текущая цена
            // История свечей
            // История стакана
            // Существующие позиции
            // Существующие заявки
            // Баланс
            // Информация об инструменте

            candles && (this.candles = candles);
            orderbook && (this.orderbook = orderbook);
            lastPrice && (this.lastPrice = lastPrice);
            balance && (this.balance = balance);

            if (options && options.tickerInfo) {
                this.tickerInfo = options.tickerInfo;
                this.tickerInfo.figi && (this.figi = this.tickerInfo.figi);

                await this.setExchangesTradingTime();
            }

            if (!this.logOrdersFile && this.accountId && this.figi) {
                const { dir, name } = Common.getLogFileName(this.name, this.accountId, this.figi, new Date());

                mkDirByPathSync(dir);
                this.logOrdersFile = path.join(dir, name);
            }
        }

        async setExchangesTradingTime() {
            const now = new Date().getTime();
            const { exchanges } = await this.cb.getTradingSchedules(this.tickerInfo.exchange, now, now);

            if (exchanges && exchanges.length) {
                const { startTime, endTime, isTradingDay } = exchanges[0] && exchanges[0].days && exchanges[0].days[0];

                this.exchange = {
                    startTime,
                    endTime,
                    isTradingDay,
                };
            }
        }

        getCurrentState() {
            return {
                name: this.name,
                interval: this.interval,
                figi: this.figi,
                date: this.date,
                backtest: this.backtest,
            };
        }

        getPrice(quotation) {
            if (!quotation || typeof quotation !== 'object') {
                return quotation;
            }

            if (quotation.nano) {
                return quotation.units + quotation.nano / 1e9;
            }

            return quotation.units;
        }

        start() {
            this.inProgress = true;
            this.subscribes();

            console.log('start'); // eslint-disable-line no-console
        }

        stop() {
            this.inProgress = false;
            clearInterval(this.intervalId);
        }

        async buy(price, figi, lotsSize, type) {
            if ((!this.figi && !figi) || !this.accountId) {
                return;
            }

            if (this.backtest) {
                return this.backtestBuy(price || this.lastPrice, lotsSize || this.lotsSize);
            }

            console.log('buy', type || ''); // eslint-disable-line no-console

            this.logOrders(await this.cb.postOrder(
                this.accountId,
                figi || this.figi,
                lotsSize || this.lotsSize,
                price || this.lastPrice, // структура из units и nano
                this.enums.OrderDirection.ORDER_DIRECTION_BUY,
                this.enums.OrderType.ORDER_TYPE_LIMIT,
                this.genOrderId(),
            ), type);

            this.updateOrders();
        }

        async logOrders(order, type) {
            if (this.backtest || !order) {
                return;
            }

            let orders;

            if (fs.existsSync(this.logOrdersFile)) {
                orders = fs.readFileSync(this.logOrdersFile).toString();
            }

            if (orders) {
                orders = JSON.parse(orders);
            } else {
                orders = [];
            }

            if (order.orderId) {
                this.orders[order.orderId] = order;
            }

            const time = new Date();

            time.setMilliseconds(0);
            time.setSeconds(0);

            // Логируем время события, чтобы нанести на график.
            order.logOrderTime = time.getTime();

            if (type) {
                order.type = type;
            }

            // Тут могут быть ещё и positions.
            // TODO: переименовать.
            orders.push(order);

            // orderTrades
            // orderId
            fs.writeFileSync(this.logOrdersFile, JSON.stringify(orders));
        }

        async closePosition(price) {
            if (this.backtest) {
                return this.backtestClosePosition(price);
            }
        }

        async getOperations() {
            return this.accountId && this.figi && await this.cb.getOperations(this.accountId, this.figi, 1, this.date);
        }

        async getPortfolio() {
            return this.accountId && await this.cb.getPortfolio(this.accountId);
        }

        async getPositions() {
            if (this.backtest) {
                return this.getBacktestPositions();
            }

            return (this.currentPortfolio && this.currentPortfolio.positions || []).filter(p => p.figi === this.figi);
        }

        async getOrders() {
            return (this.currentOrders || []).filter(p => p.figi === this.figi);
        }

        async hasOpenPositions() {
            if (this.backtest) {
                return this.hasBacktestOpenPositions();
            }

            return Boolean(this.currentPortfolio && this.currentPortfolio.positions &&
                this.currentPortfolio.positions.filter(p => p.figi === this.figi).length);
        }

        hasOpenOrders() {
            return Boolean(this.currentOrders && this.currentOrders.filter(o => o.figi === this.figi).length);
        }

        async sell(price, figi, lotsSize, type) {
            if (!this.figi && !figi) {
                return;
            }

            if (this.backtest) {
                return this.backtestClosePosition(price || this.lastPrice, lotsSize || this.lotsSize);
            }

            console.log('sell', type || ''); // eslint-disable-line no-console

            this.logOrders(await this.cb.postOrder(
                this.accountId,
                figi || this.figi,
                lotsSize || this.lotsSize,
                price || this.lastPrice, // структура из units и nano
                this.enums.OrderDirection.ORDER_DIRECTION_SELL,
                this.enums.OrderType.ORDER_TYPE_LIMIT,
                this.genOrderId(),
            ), type);

            await this.updateOrders();
        }

        setActiveOrder() {

        }

        getMinPriceIncrement(sum, minInc) {
            return Math.floor(sum / minInc) * minInc;
        }

        getTakeProfitPrice(buy, price) {
            if (typeof buy === 'undefined') {
                return;
            }

            if (!this.backtest && (!price || !this.tickerInfo)) {
                return;
            }
            const profit = buy ? (this.takeProfit + 1) : (1 - this.takeProfit);

            const p = this.getPrice(price) * profit;
            let units = Math.floor(p);
            let nano = p * 1e9 - Math.floor(p) * 1e9;

            if (this.tickerInfo.minPriceIncrement) {
                if (this.tickerInfo.minPriceIncrement.units) {
                    units = this.getMinPriceIncrement(units, this.tickerInfo.minPriceIncrement.units);
                }

                if (this.tickerInfo.minPriceIncrement.nano) {
                    nano = this.getMinPriceIncrement(nano, this.tickerInfo.minPriceIncrement.nano);
                }
            }

            return {
                units,
                nano,
            };
        }

        getStopLossPrice(buy, price) {
            if (typeof buy === 'undefined') {
                return;
            }

            if (!price || !this.tickerInfo) {
                return;
            }
            const profit = buy ? (1 - this.stopLoss) : (1 + this.stopLoss);

            const p = this.getPrice(price) * profit;
            let units = Math.floor(p);
            let nano = p * 1e9 - Math.floor(p) * 1e9;

            if (this.tickerInfo.minPriceIncrement) {
                if (this.tickerInfo.minPriceIncrement.units) {
                    units = this.getMinPriceIncrement(units, this.tickerInfo.minPriceIncrement.units);
                }

                if (this.tickerInfo.minPriceIncrement.nano) {
                    nano = this.getMinPriceIncrement(nano, this.tickerInfo.minPriceIncrement.nano);
                }
            }

            return {
                units,
                nano,
            };
        }

        setStopLoss() {

        }

        async getOpenOrders() {
            // TODO: брать из OrderExecutionReportStatus
            // EXECUTION_REPORT_STATUS_NEW (4)
            // EXECUTION_REPORT_STATUS_PARTIALLYFILL (5)
            const { orders } = (await this.cb.getOrders(this.accountId)) || {};

            return orders && orders.filter(o => [4, 5].includes(o.executionReportStatus));
        }

        async openOrdersExist() {
            const orders = this.getOpenOrders();

            return Boolean(orders && orders.length);
        }

        async cancelUnfulfilledOrders() {
            const { orders } = await this.cb.getOrders(this.accountId);

            for (const o of orders) {
                await this.cb.cancelOrder(this.accountId, o.orderId);
            }
        }

        /**
         * @copypaste https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
         * @param {Number} length
         * @returns
         */
        genOrderId(length = 15) {
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            const charactersLength = characters.length;
            let result = '';

            for (let i = 0; i < length; i++) {
                result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
            }

            if (!this.orderIds) {
                this.orderIds = {};
            }

            // Сохраняем сгенереный ключ, чтобы точно был уникальным
            // + ведём статистику насколько генератор ок.
            if (this.orderIds[result]) {
                ++this.orderIds[result];
                result = this.genOrderId(length);
            } else {
                this.orderIds[result] = 1;
            }

            return result;
        }

        static getLogs(robotName, accountId, figi, date) {
            try {
                const { dir, name } = this.getLogFileName(robotName, accountId, figi, date);
                const logFile = path.join(dir, name);
                let logs;

                if (fs.existsSync(logFile)) {
                    logs = fs.readFileSync(logFile).toString();

                    if (logs) {
                        return JSON.parse(logs);
                    }
                }
            } catch (e) { console.log(e) } // eslint-disable-line no-console
        }

        static getLogFileName(name, accountId, figi, date) {
            const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };

            return {
                dir: path.resolve(__dirname, '../../orders', name, accountId, figi),
                name: new Date(Number(date)).toLocaleString('ru', dateOptions) + '.json',
            };
        }

        static getStaticFileSettings(name, accountId, figi) {
            if (!name || !accountId || !figi) {
                return;
            }

            const dir = path.resolve(__dirname, '../../orders', name, accountId, figi);

            mkDirByPathSync(dir);

            return path.join(dir, 'settings.json');
        }

        /**
         * Получение настроек робота из файла или значений по умолчанию.
         *
         * @param {String} name
         * @param {String} figi
         * @param {String} accountId
         * @returns
         */
        static getSettings(name, accountId, figi) {
            const settings = {
                isAdviser: false,
                takeProfit: 0.005,
                stopLoss: 0.0025,
                lotsSize: 1,
                support: { units: 0, nano: 0 },
                resistance: { units: 0, nano: 0 },
            };

            if (name && accountId && figi) {
                const file = this.getStaticFileSettings(name, accountId, figi);

                if (fs.existsSync(file)) {
                    return JSON.parse(fs.readFileSync(file).toString());
                }
            }

            return settings;
        }

        /**
         * Устанавливает настройки и сохраняет в файл.
         *
         * @param {String} name
         * @param {Object} settings
         * @param {String} accountId
         * @param {String} figi
         * @returns
         */
        static setSettings(name, settings, accountId, figi) {
            const current = this.getSettings(name);

            typeof settings.isAdviser !== 'undefined' && (current.isAdviser = Boolean(settings.isAdviser));

            settings.takeProfit = parseFloat(settings.takeProfit);
            settings.takeProfit > 0 && (current.takeProfit = settings.takeProfit);

            settings.stopLoss = parseFloat(settings.stopLoss);
            settings.stopLoss > 0 && (current.stopLoss = settings.stopLoss);

            settings.lotsSize = parseInt(settings.lotsSize, 10);
            settings.lotsSize > 0 && (current.lotsSize = settings.lotsSize);

            settings.su = parseInt(settings.su, 10);
            settings.su > 0 && (current.support.units = settings.su);
            settings.sn = parseInt(settings.sn, 10);
            settings.sn > 0 && (current.support.nano = settings.sn);

            settings.ru = parseInt(settings.ru, 10);
            settings.ru > 0 && (current.resistance.units = settings.ru);
            settings.rn = parseInt(settings.rn, 10);
            settings.rn > 0 && (current.resistance.nano = settings.rn);

            if (name && accountId && figi) {
                const file = this.getStaticFileSettings(name, accountId, figi);

                file && fs.writeFileSync(file, JSON.stringify(current));
            }

            return current;
        }

        /**
         * Устанавливает настройки для запущенного робота.
         *
         * @param {String} name
         * @param {Object} settings
         * @param {String} accountId
         * @param {String} figi
         * @returns
         */
        setCurrentSettings(settings) {
            const current = Common.setSettings(this.name, settings, this.accountId, this.figi);

            this.getCurrentSettings();
        }

        getCurrentSettings() {
            const current = Common.getSettings(this.name, this.accountId, this.figi);

            // Если робот работает в режиме советника,
            // то он только обозначает предположения, но не делает сделки.
            // this.adviser = Boolean(adviser);
            // 1 = 100%, 0.003 = 0.003%
            // this.takeProfit = 0.004;
            // На сколько процентов от текущей цены выставлять stopLoss.
            // 1 = 100%, 0.003 = 0.003%
            // this.stopLoss = 0.002;
            // Количество лотов, которым оперирует робот.
            // this.lotsSize = 1;

            this.isAdviser = current.isAdviser;
            this.takeProfit = current.takeProfit;
            this.stopLoss = current.stopLoss;
            this.lotsSize = current.lotsSize;

            // Уровни поддержки и сопротивления.
            this.support = current.support;
            this.resistance = current.resistance;
        }
    }

    module.exports.Common = Common;
} catch (e) {
    // Здесь будут только ошибки в коде робота,
    // Которые должны быть отловлены во время разработки.
    // Поэтому нет сохранения в файл. Только вывод в консоль.
    // TODO: сохранять в файл.
    console.log(e); // eslint-disable-line no-console
}
