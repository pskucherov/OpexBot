const { mkDirByPathSync } = require('../utils');
const path = require('path');
const fs = require('fs');

try {
    class Common {
        constructor(accountId, adviser, backtest, callbacks = {
            subscribes: {},

            // TODO: порефакторить количество параметров
            postOrder: (accountId, figi, quantity, price, direction, orderType, orderId) => { }, // eslint-disable-line max-params
            cacheState: (figi, time, lastPrice, orderBook) => { },
        }, options = {
            enums: {},
            brokerId: '',

            // takeProfit: 3,
            // stopLoss: 1,
            // useTrailingStop: true,
        }) {
            this.accountId = accountId;
            this.backtest = Boolean(backtest);
            this.enums = options.enums;
            this.brokerId = options.brokerId;

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
            this.subscribesTimer = 100;

            // Таймер выполнения process
            this.robotTimer = 1500;
            this.subscribeDataUpdated = {};

            this.orders = {};

            // Устанавливает возможна ли торговля в данный момент.
            // Для бектеста всегда включено.
            // this.tradingTime = Boolean(this.backtest);
            this.tradingTime = true;

            this.getCurrentSettings();
        }

        /**
         * Проверяет возможность торговли в данный день и время.
         */
        async checkTradingDayAndTime() {
            if (this.backtest) {
                this.tradingTime = true;
            }

            if (this.brokerId === 'FINAM') {
                // По умолчанию для финам всегда торговый день.
                // И запускать можно только на торги.
                // TODO: сделать переход с одних торгов на другие.
                this.tradingTime = true;

                return;
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
            await this.updateOrders();
            await this.updatePortfolio();
            await this.updatePositions();
        }

        async updateOrders() {
            if (this.backtest) {
                return;
            }

            this.currentOrders = await this.getOpenOrders();

            // this.currentPositions = await this.getPositions();
            // await this.updatePortfolio();
            // this.currentOperations = await this.getOperations();

            this.ordersInited = true;
        }

        async updatePortfolio() {
            this.currentPortfolio = await this.getPortfolio();
        }

        async updatePositions() {
            this.currentPositions = await this.getPositions();
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
                    if (subscribes[name] && !this.isSandbox) {
                        setImmediate(async () => {
                            const subscribeArr = subscribes[name]();

                            const gen = subscribeArr[0]((async function* () {
                                while (this.inProgress) {
                                    await this.timer(this.subscribesTimer);

                                    if (this.figi) {
                                        const figi = typeof this.figi === 'string' ? this.figi.split(',') : this.figi;

                                        yield subscribeArr[1](figi);
                                    }
                                }
                            }).call(this));

                            for await (const data of gen) {
                                if (data[name]) {
                                    this.subscribeDataUpdated[name] = true;
                                    const isLastPrice = name === 'lastPrice';
                                    const currentData = isLastPrice ? data[name].price : data[name];

                                    this[data[name].figi] || (this[data[name].figi] = {});
                                    this[data[name].figi][name] = currentData;

                                    if (!this.isPortfolio) {
                                        this[name] = currentData;
                                    }
                                }
                                if (!this.inProgress) {
                                    break;
                                }
                            }
                        });
                    }
                });

                ['orders', 'positions'].forEach(name => {
                    if (subscribes[name] && !this.isSandbox) {
                        setImmediate(async () => {
                            const gen = subscribes[name]({
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
                                } else if (data.position && this.isPortfolio) {
                                    [
                                        'securities',

                                        // 'futures',
                                        // 'options',
                                    ].forEach(name => {
                                        if (!data.position[name] || !data.position[name].length) {
                                            return;
                                        }

                                        data.position[name].forEach(p => {
                                            const currentIndex = this.currentPositions.findIndex(c => {
                                                return c.figi === p.figi && c.instrumentType === p.instrumentType;
                                            });

                                            if (currentIndex >= 0) {
                                                this.currentPositions[currentIndex] = {
                                                    ...this.currentPositions[currentIndex],
                                                    ...p,
                                                };
                                            } else {
                                                this.updatePositions();
                                            }
                                        });
                                    });

                                    await this.updateFigi();
                                }

                                if (!this.inProgress) {
                                    break;
                                }
                            }
                        });
                    }
                });
            } catch (e) { console.log(e) } // eslint-disable-line no-console
        }

        /**
         * Обновляем figi для портфельного управления.
         */
        async updateFigi() {
            // При портфельном управлении содержимое портфеля может меняться.
            // Это нужно учитывать в подписках на цену.
            if (this.isPortfolio) {
                // await this.updatePortfolio();

                if (this.currentPortfolio?.positions?.length) {
                    this.figi = this.currentPortfolio.positions.map(p => p.figi);
                } else {
                    this.figi = [];
                }
            }
        }

        /**
         * Модуль обработки данных.
         * По сути бесконечный цикл, который обрабатывает входящие данные.
         */
        async processing() {
            try {
                if (!this.inProgress && !this.backtest) {
                    setImmediate(() => this.processing());

                    return;
                }

                if (!this.backtest) {
                    await this.checkExchangeDay();
                    await this.checkTradingDayAndTime();

                    if (this.brokerId === 'FINAM') {
                        await this.updateOrders();
                        await this.updatePortfolio();

                        // update orderbook
                        // update price
                        // TODO: поменять на bid и ...
                        this.testData = this.cb.getQuotationsAndOrderbook(this.figi);
                        this.lastPrice = this.testData?.quotations?.bid;
                    }
                }

                if (this.tradingTime) {
                    await this.updateOrders();

                    // await this.updatePortfolio();
                    await this.updatePositions();

                    this.getCurrentSettings();

                    // Обрабатываем логику только после инициализации статуса.
                    if (this.ordersInited || this.backtest) {
                        if (await this.decisionClosePosition()) {
                            console.log('decisionClosePosition'); // eslint-disable-line no-console
                            await this.closePosition(this.lastPrice);
                        } else if (await this.decisionBuy()) {
                            console.log('decisionBuy'); // eslint-disable-line no-console
                            await this.buy();
                        } else if (await this.decisionSell()) {
                            console.log('decisionBuy'); // eslint-disable-line no-console
                            await this.sell();
                        }
                    }

                    // Записываем новое состояние, только если оно изминилось.
                    if (!this.backtest && this.figi && this.cb.cacheState &&
                        (this.subscribeDataUpdated.orderbook && this.subscribeDataUpdated.lastPrice)) {
                        this.cb.cacheState(this.getFileName(), new Date().getTime(), this.lastPrice, this.orderbook);
                        this.subscribeDataUpdated.lastPrice = false;
                        this.subscribeDataUpdated.orderbook = false;
                    }
                }

                // Для бектестирования производится пошаговая обработка сделок,
                // а не рекурсивная.
                if (!this.backtest) {
                    setImmediate(async () => {
                        await this.timer(this.robotTimer);
                        this.processing();
                    });
                }
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
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

            if (options) {
                if (options.type) {
                    this.isPortfolio = options.type === 'portfolio';
                    this.type = options.type;
                }

                if (options.tickerInfo) {
                    this.tickerInfo = options.tickerInfo;

                    // this.tickerInfo.figi && (this.figi = this.tickerInfo.figi);
                    options.figi && (this.figi = options.figi);

                    await this.setExchangesTradingTime();
                }
            }

            if (!this.logOrdersFile && this.accountId) {
                const { dir, name } = Common.getLogFileName(this.name, this.accountId,
                    this.getFileName(), new Date());

                mkDirByPathSync(dir);
                this.logOrdersFile = path.join(dir, name);
            }
        }

        getFileName() {
            return this.isPortfolio ? this.type : this.figi;
        }

        async setExchangesTradingTime() {
            const now = new Date().getTime();
            const { exchanges } = this.cb.getTradingSchedules &&
                await this.cb.getTradingSchedules(
                    this.tickerInfo.exchange || this.tickerInfo[0].exchange, now, now,
                ) || {};

            if (exchanges && exchanges.length) {
                const { startTime, endTime, isTradingDay } = exchanges[0] && exchanges[0].days && exchanges[0].days[0];

                this.exchange = {
                    startTime,
                    endTime,
                    isTradingDay,
                    today: new Date().getDate(),
                };
            }
        }

        async checkExchangeDay() {
            if (this.exchange && this.exchange.today !== new Date().getDate()) {
                await this.setExchangesTradingTime();
            }
        }

        getCurrentState() {
            return {
                name: this.name,
                interval: this.interval,
                figi: this.figi,
                date: this.date,
                backtest: this.backtest,
                type: this.type,
            };
        }

        static getPrice(quotation) {
            if (!quotation || typeof quotation !== 'object') {
                return quotation;
            }

            if (quotation.nano) {
                return quotation.units + quotation.nano / 1e9;
            }

            return quotation.units;
        }

        getPrice(quotation) {
            return Common.getPrice(quotation);
        }

        start() {
            this.inProgress = true;

            this.subscribes();

            console.log('start'); // eslint-disable-line no-console
        }

        stop() {
            this.inProgress = false;
            clearInterval(this.intervalId);
            console.log('stop'); // eslint-disable-line no-console
        }

        async buy(price, figi, lotsSize, type) {
            try {
                if ((!this.figi && !figi) || !this.accountId) {
                    return;
                }

                if (this.backtest) {
                    return this.backtestBuy(price || this.lastPrice, lotsSize || this.lotsSize);
                }

                console.log('buy', type || '', lotsSize); // eslint-disable-line no-console

                const order = this.cb.postOrder && (await this.cb.postOrder(
                    this.accountId,
                    figi || this.figi,
                    lotsSize || this.lotsSize,
                    price || this.lastPrice, // структура из units и nano
                    this.enums.OrderDirection.ORDER_DIRECTION_BUY,
                    this.enums.OrderType.ORDER_TYPE_LIMIT,
                    this.genOrderId(),
                ));

                order && this.logOrders && this.logOrders(order, type);

                await this.updateOrders();
                this.setLastOrderTime();
            } catch (e) {
                console.log('buy', e); // eslint-disable-line no-console
            }
        }

        async logOrders(order, type) {
            try {
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
            } catch (e) {
                console.log('logOrders', e); // eslint-disable-line no-console
            }
        }

        async closePosition(price) {
            if (this.backtest) {
                return this.backtestClosePosition(price);
            }
        }

        async getOperations() {
            return this.accountId && this.figi && this.cb.getOperations &&
                await this.cb.getOperations(this.accountId,
                    this.isPortfolio ? undefined : this.figi, 1, this.date);
        }

        async getPortfolio() {
            return this.accountId && this.cb.getPortfolio &&
                (await this.cb.getPortfolio(this.accountId)); // , this.isPortfolio ? undefined : this.figi));
        }

        async getPositions() {
            if (this.backtest) {
                return this.getBacktestPositions();
            }

            return (this.currentPortfolio && this.currentPortfolio.positions || [])
                .filter(p => {
                    return this.isPortfolio || this.checkFigi(p.figi); // FINAM figi
                });
        }

        checkFigi(figi) {
            if (this.isPortfolio) {
                return true;
            }

            return figi === this.figi || Boolean(this.tickerInfo && (
                figi === this.tickerInfo.noBoardFigi ||
                figi === this.tickerInfo.noMarketFigi));
        }

        async getOrders() {
            return (this.currentOrders || []).filter(p => this.checkFigi(p.figi));
        }

        async hasOpenPositions(type = 'share') {
            if (this.backtest) {
                return this.hasBacktestOpenPositions();
            }

            return Boolean(this.currentPortfolio && this.currentPortfolio.positions &&
                this.currentPortfolio.positions.filter(p =>
                    Boolean(this.checkFigi(p.figi)).length && p.instrumentType === type));
        }

        hasOpenOrders() {
            return Boolean(this.currentOrders && this.currentOrders.filter(o => this.checkFigi(o.figi)).length);
        }

        async closeAllOrders() {
            this.currentOrders
                .filter(o => [4, 5].includes(o.executionReportStatus))
                .forEach(async o => await this.cancelOrder(o.orderId));
        }

        async sell(price, figi, lotsSize, type) {
            try {
                if (!this.figi && !figi) {
                    return;
                }

                if (this.backtest) {
                    return this.backtestClosePosition(price || this.lastPrice, lotsSize || this.lotsSize);
                }

                console.log('sell', type || '', lotsSize); // eslint-disable-line no-console

                this.cb.postOrder && this.logOrders(await this.cb.postOrder(
                    this.accountId,
                    figi || this.figi,
                    lotsSize || this.lotsSize,
                    price || this.lastPrice, // структура из units и nano
                    this.enums.OrderDirection.ORDER_DIRECTION_SELL,
                    this.enums.OrderType.ORDER_TYPE_LIMIT,
                    this.genOrderId(),
                ), type);

                await this.updateOrders();
                this.setLastOrderTime();
            } catch (e) {
                console.log('sell', e); // eslint-disable-line no-console
            }
        }

        setLastOrderTime() {
            this.lastOrderTime = new Date().getTime();
        }

        setActiveOrder() {

        }

        getMinPriceIncrement(sum, minInc) {
            return Math.floor(sum / minInc) * minInc;
        }

        /**
         * Расчитывает цену фиксации по TP.
         *
         * @param {?Boolean} isForShort — расчитать для позиции шорта.
         * @param {Object[units, nano]} price — цена, от которой расчитывать цену заявки.
         * @returns
         */
        getTakeProfitPrice(isForShort, price) {
            try {
                if (typeof isForShort === 'undefined') {
                    return;
                }

                if (!this.backtest && (!price || !this.tickerInfo)) {
                    return;
                }

                const profit = isForShort ? (this.takeProfit + 1) : (1 - this.takeProfit);

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
            } catch (e) {
                console.log('getTakeProfitPrice', e); // eslint-disable-line no-console
            }
        }

        // /**
        //  * Расчитывает цену лимитной заявки, которая ставится меньше текущей цены.
        //  *
        //  * @param {?Boolean} isForShort — расчитать для позиции шорта.
        //  * @param {Object[units, nano]} price
        //  * @param {Object[units, nano]} minPriceIncrement
        //  * @param {?Number} deltaSize — сколько раз по minPriceIncrement нужно отступить от текущей цены.
        //  */
        // getLimitPrice(isForShort, price, minPriceIncrement, deltaSize = 1) {
        //     let units;
        //     let nano;

        //     // Для лонга уменьшаем заявку,
        //     // для шорта увеличиваем.
        //     if (isForShort) {
        //         price.units = price.units + minPriceIncrement.units * deltaSize;
        //         price.nano = price.nano + minPriceIncrement.nano * deltaSize;
        //     } else {
        //         price.units = price.units - minPriceIncrement.units * deltaSize;
        //         price.nano = price.nano - minPriceIncrement.nano * deltaSize;
        //     }

        //     return {
        //         units,
        //         nano,
        //     };
        // }

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
            try {
                // TODO: брать из OrderExecutionReportStatus
                // EXECUTION_REPORT_STATUS_NEW (4)
                // EXECUTION_REPORT_STATUS_PARTIALLYFILL (5)
                const { orders } = this.cb.getOrders && (await this.cb.getOrders(this.accountId)) || {};

                this.allOrders = orders;

                return orders && orders.filter(o => [4, 5].includes(o.executionReportStatus));
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }
        }

        async openOrdersExist() {
            const orders = this.getOpenOrders();

            return Boolean(orders && orders.length);
        }

        async cancelUnfulfilledOrders() {
            if (!this.cb.getOrders) {
                return;
            }

            const { orders } = await this.cb.getOrders(this.accountId, this.figi);

            for (const o of orders) {
                await this.cancelOrder(o.orderId);
            }

            this.setLastOrderTime();
        }

        async cancelOrder(orderId) {
            this.setLastOrderTime();

            return (await this.cb.cancelOrder(this.accountId, orderId));
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
                takeProfit: 0.05,
                stopLoss: 0.02,
                volume: 1,
                lotsSize: 1,

                orderType: 1, // лимитная заявка =1. Рыночная =2. this.enums.OrderType.ORDER_TYPE_LIMIT
                orderTimeout: 30, // секунд.

                startTradingTimeHours: 0,
                startTradingTimeMinutes: 0,
                endTradingTimeHours: 23,
                endTradingTimeMinutes: 59,

                tradingDays: 0b1111100, // Битовая маска 7 значений для 7 дней. Старший бит — понедельник.

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
        static setSettings(name, settings, accountId, figi) { // eslint-disable-line
            const current = this.getSettings(name);

            typeof settings.isAdviser !== 'undefined' && (current.isAdviser = Boolean(settings.isAdviser));

            settings.takeProfit = parseFloat(settings.takeProfit);
            settings.takeProfit > 0 && settings.takeProfit <= 100 && (current.takeProfit = settings.takeProfit);

            settings.stopLoss = parseFloat(settings.stopLoss);
            settings.stopLoss > 0 && settings.stopLoss <= 100 && (current.stopLoss = settings.stopLoss);

            settings.volume = parseFloat(settings.volume);
            settings.volume > 0 && settings.volume <= 100 && (current.volume = settings.volume);

            [
                'lotsSize',

                'su',
                'sn',
                'ru',
                'rn',

                'orderType',
                'orderTimeout',

                'startTradingTimeHours',
                'startTradingTimeMinutes',
                'endTradingTimeHours',
                'endTradingTimeMinutes',

                'tradingDays',
            ].forEach(name => {
                settings[name] = parseInt(settings[name], 10);
            });

            settings.lotsSize > 0 && (current.lotsSize = settings.lotsSize);

            settings.su > 0 && (current.support.units = settings.su);
            settings.sn > 0 && (current.support.nano = settings.sn);

            settings.ru > 0 && (current.resistance.units = settings.ru);
            settings.rn > 0 && (current.resistance.nano = settings.rn);

            [1, 2].includes(settings.orderType) && (current.orderType = settings.orderType);

            settings.orderTimeout > 0 && (current.orderTimeout = settings.orderTimeout);

            if (settings.startTradingTimeHours >= 0 && settings.startTradingTimeHours <= 23 &&
                settings.startTradingTimeHours <= settings.endTradingTimeHours) {
                current.startTradingTimeHours = settings.startTradingTimeHours;
            } else {
                current.startTradingTimeHours = 0;
            }

            if (settings.endTradingTimeHours >= 0 && settings.endTradingTimeHours <= 23 &&
                settings.endTradingTimeHours >= settings.startTradingTimeHours) {
                current.endTradingTimeHours = settings.endTradingTimeHours;
            } else {
                current.endTradingTimeHours = 23;
            }

            if (settings.startTradingTimeMinutes >= 0 && settings.startTradingTimeMinutes <= 59 &&
                settings.startTradingTimeMinutes <= settings.endTradingTimeMinutes) {
                current.startTradingTimeMinutes = settings.startTradingTimeMinutes;
            } else {
                current.startTradingTimeMinutes = 0;
            }

            if (settings.endTradingTimeMinutes >= 0 && settings.endTradingTimeMinutes <= 59 &&
                settings.endTradingTimeMinutes >= settings.startTradingTimeMinutes) {
                current.endTradingTimeMinutes = settings.endTradingTimeMinutes;
            } else {
                current.endTradingTimeMinutes = 59;
            }

            if (settings.tradingDays > 0 && settings.tradingDays <= 127) {
                current.tradingDays = settings.tradingDays;
            }

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
            const current = Common.setSettings(this.name, settings, this.accountId, this.getFileName());

            this.getCurrentSettings();
        }

        getCurrentSettings() {
            const current = Common.getSettings(this.name, this.accountId, this.getFileName());

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
            this.volume = current.volume;
            this.lotsSize = current.lotsSize;

            // Уровни поддержки и сопротивления.
            this.support = current.support;
            this.resistance = current.resistance;

            this.orderType = current.orderType;
            this.orderTimeout = current.orderTimeout;

            this.startTradingTimeHours = current.startTradingTimeHours;
            this.startTradingTimeMinutes = current.startTradingTimeMinutes;
            this.endTradingTimeHours = current.endTradingTimeHours;
            this.endTradingTimeMinutes = current.endTradingTimeMinutes;

            this.tradingDays = current.tradingDays;
        }

        getTickerInfo() {
            return this.tickerInfo || {};
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
