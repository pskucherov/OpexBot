try {
    class Common {
        constructor(accountId, adviser, backtest, callbacks = {
            subscribes: {},
            setOrder: () => {},
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

        setBacktestState(step, interval, figi) {
            step && (this.step = step);
            interval && (this.interval = interval);
            figi && (this.figi = figi);
        }

        getBacktestState() {
            return {
                name: this.name,
                step: this.step,
                interval: this.interval,
                figi: this.figi,
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

        clearUnfulfilledOrders() {
        // Удалить неисполненные заявки
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

            // Сохраняем сгенереный ключ, чтобы точно был уникальным + ведём статистику насколько генератор ок.
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
} catch (e) {}
