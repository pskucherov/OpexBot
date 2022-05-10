class Common {
    constructor(adviser, backtest, options = {
        takeProfit: 3,
        stopLoss: 1,
        useTrailingStop: true,
    }) {
        // Если робот работает в режиме советника,
        // то он только обозначает предположения, но не делает сделки.
        this.adviser = Boolean(adviser);

        // На сколько процентов от текущей цены выставлять takeProfit.
        this.takeProfit = options.takeProfit;

        // На сколько процентов от текущей цены выставлять stopLoss.
        this.stopLoss = options.stopLoss;

        // Автоматически переставлять stopLoss и takeProfit при движении цены в нужную сторону.
        this.useTrailingStop = options.useTrailingStop;

        this.processing();
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

        this.candles = candles;
        this.orderbook = orderbook;
        this.lastPrice = lastPrice;
        this.balance = balance;
        this.tickerInfo = tickerInfo;
    }

    getCurrentState() {
        return [this.candles, this.orderbook];
    }

    start() {
        this.inProgress = true;
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
}

module.exports.Common = Common;
