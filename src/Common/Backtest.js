const { Common } = require('./Common');

try {
    class Backtest extends Common {
        init() {
            super.init();

            this.backtestPositions = [];
            this.backtestOrders = [];
        }

        setBacktestState(step, interval, instrumentId, date, options) {
            interval && (this.interval = interval);
            instrumentId && (this.instrumentId = instrumentId);
            date && (this.date = date);

            if (step && this.step !== step) {
                this.step = step;

                // Для каждого шага вызываем обработчик.
                this.processing();
            }

            if (options && options.tickerInfo) {
                this.tickerInfo = options.tickerInfo;
            }
        }

        getBacktestState() {
            return {
                name: this.name,
                step: this.step,
                interval: this.interval,
                instrumentId: this.instrumentId,
                date: this.date,
            };
        }

        backtestBuy(price, lots) {
            this.backtestPositions.push({
                id: this.genOrderId(),
                parentId: '',
                step: this.step,
                price: price,
                averagePositionPrice: price,
                lots: lots || this.lotsSize,
                direction: this.enums.OrderDirection.ORDER_DIRECTION_BUY,
                quantity: {
                    units: this.tickerInfo.lot,
                },
                closed: false,
            });
        }

        backtestClosePosition(price, lots) {
            for (const p of this.backtestPositions) {
                if (!p.closed) {
                    p.closed = true;

                    this.backtestPositions.push({
                        id: this.genOrderId(),
                        parentId: p.id,
                        step: this.step,
                        price: price,
                        averagePositionPrice: price,
                        lots: lots || this.lotsSize,
                        quantity: {
                            units: this.tickerInfo.lot,
                        },
                        direction: this.enums.OrderDirection.ORDER_DIRECTION_SELL,
                        expectedYield: {
                            units: price.units - p.price.units,
                            nano: price.nano - p.price.nano,
                        },
                        closed: true,
                    });

                    // Считаем, что может быть только одна открытая сделка, поэтому выходим.
                    return;
                }
            }
        }

        getBacktestPositions() {
            return this.backtestPositions;
        }

        getBacktestOrders() {
            return this.backtestOrders;
        }

        hasBacktestOpenPositions() {
            for (const p of this.backtestPositions) {
                if (!p.closed) {
                    return true;
                }
            }

            return false;
        }

        stop() {
            super.stop();

            this.backtestPositions = [];
            this.backtestOrders = [];
        }
    }

    module.exports.Backtest = Backtest;
} catch (e) {
    // Здесь будут только ошибки в коде робота,
    // Которые должны быть отловлены во время разработки.
    // Поэтому нет сохранения в файл. Только вывод в консоль.
    console.log(e); // eslint-disable-line no-console
}
