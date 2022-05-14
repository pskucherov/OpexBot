try {
    class Common {
        constructor(accountId, adviser, backtest, callbacks = {
            subscribes: {},

            // TODO: порефакторить количество параметров
            postOrder: (accountId, figi, quantity, price, direction, orderType, orderId) => {}, // eslint-disable-line max-params
            cacheState: (figi, time, lastPrice, orderBook) => {},
        }, options = {
            takeProfit: 3,
            stopLoss: 1,
            useTrailingStop: true,
        }) {
            this.accountId = accountId;

            // Если робот работает в режиме советника,
            // то он только обозначает предположения, но не делает сделки.
            this.adviser = Boolean(adviser);
            this.backtest = Boolean(backtest);

            // Методы, с помощью которых робот может общаться с внешним миром.
            this.cb = callbacks;

            // На сколько процентов от текущей цены выставлять takeProfit.
            this.takeProfit = options.takeProfit;

            // На сколько процентов от текущей цены выставлять stopLoss.
            this.stopLoss = options.stopLoss;

            // Автоматически переставлять stopLoss и takeProfit при движении цены в нужную сторону.
            this.useTrailingStop = options.useTrailingStop;

            this.timer = 250;

            this.processing();
        }

        subscribes() {
            const { subscribes } = this.cb;

            this.subscribeDataUpdated = {};

            const timer = time => new Promise(resolve => setTimeout(resolve, time));

            ['lastPrice', 'orderbook'].forEach(name => {
                if (subscribes[name]) {
                    setImmediate(async () => {
                        const gen = subscribes[name][0]((async function* () {
                            while (this.inProgress) {
                                await timer(this.timer);
                                yield subscribes[name][1]();
                            }
                        }).call(this));

                        for await (const data of gen) {
                            if (data[name]) {
                                this.subscribeDataUpdated[name] = true;
                                this[name] = name === 'lastPrice' ? data[name].price : data[name];
                            }
                        }
                    });
                }
            });
        }

        /**
         * Модуль обработки данных.
         * По сути бесконечный цикл, который обрабатывает входящие данные.
         */
        processing() {
            if (!this.inProgress) {
                setImmediate(() => this.processing());

                return;
            }

            if (this.decisionBuy()) {
                this.buy();
            } else if (this.decisionSell()) {
                this.sell();
            }

            // Записываем новое состояние, только если оно изминилось.
            if (this.cb.cacheState && (this.subscribeDataUpdated.orderBook || this.subscribeDataUpdated.lastPrice)) {
                this.cb.cacheState(this.figi, new Date().getTime(), this.lastPrice, this.orderbook);
                this.subscribeDataUpdated.lastPrice = false;
                this.subscribeDataUpdated.orderbook = false;
            }

            setImmediate(() => this.processing());
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

        setControlsCallbacks() {
        // Метод покупки
        // Продажи
        // Выставления заявки
        }

        setCurrentState(lastPrice, candles, balance, tickerInfo, orderbook) {
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
            tickerInfo && (this.tickerInfo = tickerInfo);
        }

        setBacktestState(step, interval, figi, date) {
            step && (this.step = step);
            interval && (this.interval = interval);
            figi && (this.figi = figi);
            date && (this.date = date);
        }

        getBacktestState() {
            return {
                name: this.name,
                step: this.step,
                interval: this.interval,
                figi: this.figi,
                date: this.date,
            };
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

        buy() {

        }

        sell() {

        }

        setActiveOrder() {

        }

        setTakeProfit() {

        }

        setStopLoss() {

        }

        async openOrdersExist() {
            // EXECUTION_REPORT_STATUS_NEW (4)
            // EXECUTION_REPORT_STATUS_PARTIALLYFILL (5)
            const { orders } = await this.cb.getOrders(this.accountId);

            for (const o of orders) {
                if ([4, 5].includes(o.executionReportStatus)) {
                    return true;
                }
            }

            return false;
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
