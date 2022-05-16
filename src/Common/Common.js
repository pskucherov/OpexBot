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

            // Если робот работает в режиме советника,
            // то он только обозначает предположения, но не делает сделки.
            this.adviser = Boolean(adviser);
            this.backtest = Boolean(backtest);

            this.enums = options.enums;

            // Методы, с помощью которых робот может общаться с внешним миром.
            this.cb = callbacks;

            // На сколько процентов от текущей цены выставлять takeProfit.
            // Цена будет умножена на это значение.
            this.takeProfit = 0.03; // options.takeProfit;

            // На сколько процентов от текущей цены выставлять stopLoss.
            // this.stopLoss = options.stopLoss;

            // Автоматически переставлять stopLoss и takeProfit при движении цены в нужную сторону.
            // this.useTrailingStop = options.useTrailingStop;

            this.init();

            this.processing();

            this.initAsync();
        }

        init() {
            // Количество лотов, которым оперирует робот.
            this.lotsSize = 1;

            // Таймер подписки на события.
            this.timer = 250;
            this.subscribeDataUpdated = {};
        }

        async initAsync() {
            this.currentOrders = await this.getOpenOrders();
            console.log(this.currentOrders);
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

        subscribes() { // eslint-disable-line sonarjs/cognitive-complexity
            try {
                if (this.backtest) {
                    return;
                }

                const { subscribes } = this.cb;

                const timer = time => new Promise(resolve => setTimeout(resolve, time));

                ['orders'].forEach(name => {
                    if (subscribes[name]) {
                        setImmediate(async () => {
                            const gen = subscribes[name][0]((async function* () {
                                while (this.inProgress) {
                                    await timer(this.timer);
                                    yield subscribes[name][1]();
                                }
                            }).call(this));

                            for await (const data of gen) {
                                console.log(data);
                                if (data[name]) {
                                    this.subscribeDataUpdated[name] = true;

                                    //this[name] = name === 'lastPrice' ? data[name].price : data[name];
                                }
                            }
                        });
                    }
                });
            } catch (e) { console.log(e) }
        }

        /**
         * Модуль обработки данных.
         * По сути бесконечный цикл, который обрабатывает входящие данные.
         */
        processing() {
            if (!this.inProgress && !this.backtest) {
                setImmediate(() => this.processing());

                return;
            }

            if (this.decisionClosePosition()) {
                this.closePosition(this.lastPrice);
            } else if (this.decisionBuy()) {
                this.buy(this.lastPrice);
            } else if (this.decisionSell()) {
                this.sell();
            }

            // Записываем новое состояние, только если оно изминилось.
            if (!this.backtest && this.figi && this.cb.cacheState &&
                (this.subscribeDataUpdated.orderbook && this.subscribeDataUpdated.lastPrice)) {
                this.cb.cacheState(this.figi, new Date().getTime(), this.lastPrice, this.orderbook);
                this.subscribeDataUpdated.lastPrice = false;
                this.subscribeDataUpdated.orderbook = false;
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

        setCurrentState(lastPrice, candles, balance, orderbook, options) {
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
                if (options.tickerInfo) {
                    this.tickerInfo = options.tickerInfo;
                    this.tickerInfo.figi && (this.figi = options.figi);
                }
            }
        }

        getCurrentState() {
            return [this.candles, this.orderbook];
        }

        getPrice(quotation) {
            if (quotation.nano) {
                return quotation.units + quotation.nano / 1e9;
            }

            return quotation.units;
        }

        start() {
            this.inProgress = true;
            this.subscribes();
        }

        stop() {
            this.inProgress = false;
        }

        async buy(price) {
            if (this.backtest) {
                return this.backtestBuy(price, this.lotsSize);
            }

            return await this.cb.postOrder(
                this.accountId,
                this.figi,
                this.lotsSize,
                price, // структура из units и nano
                this.enums.OrderDirection.ORDER_DIRECTION_BUY,
                this.enums.OrderType.ORDER_TYPE_LIMIT,
                this.genOrderId(),
            );
        }

        async closePosition(price) {
            if (this.backtest) {
                return this.backtestClosePosition(price);
            }
        }

        getPositions() {
            if (this.backtest) {
                return this.getBacktestPositions();
            }

            // TODO: торговые позиции
        }

        hasOpenPositions() {
            if (this.backtest) {
                return this.hasBacktestOpenPositions();
            }

            return this.getPositions(); // TODO возвращать boolean;
        }

        sell() {

        }

        setActiveOrder() {

        }

        getMinPriceIncrement(sum, minInc) {
            return Math.floor(sum / minInc) * minInc;
        }

        getTakeProfitPrice(buy) {
            if (typeof buy === 'undefined') {
                return;
            }

            // console.log(this.lastPrice);
            if (!this.lastPrice || !this.tickerInfo) {
                return;
            }
            const profit = buy ? (this.takeProfit + 1) : (1 - this.takeProfit);

            const p = this.getPrice(this.lastPrice) * profit;
            let units = Math.floor(p);
            let nano = p * 1e9 - Math.floor(p) * 1e9;

            if (this.tickerInfo.minPriceIncrement.units) {
                units = this.getMinPriceIncrement(units, this.tickerInfo.minPriceIncrement.units);
            }

            if (this.tickerInfo.minPriceIncrement.nano) {
                nano = this.getMinPriceIncrement(nano, this.tickerInfo.minPriceIncrement.nano);
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
            const { orders } = await this.cb.getOrders(this.accountId);

            return orders.filter(o => [4, 5].includes(o.executionReportStatus));
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
    }

    module.exports.Common = Common;
} catch (e) {
    // Здесь будут только ошибки в коде робота,
    // Которые должны быть отловлены во время разработки.
    // Поэтому нет сохранения в файл. Только вывод в консоль.
    console.log(e); // eslint-disable-line no-console
}
