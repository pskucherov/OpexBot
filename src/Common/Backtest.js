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

        backtestBuy(price, lots, time) {
            this.backtestPositions.push({
                id: this.genOrderId(),
                parentId: '',
                step: this.step,
                price: price,
                averagePositionPrice: price,
                lots: lots || this.lotsSize,
                time: time,
                direction: this.enums.OrderDirection.ORDER_DIRECTION_BUY,
                quantity: {
                    units: this.tickerInfo.lot,
                },
                closed: false,
            });
        }

        backtestSell(price, lots, time) {
            this.backtestPositions.push({
                id: this.genOrderId(),
                parentId: '',
                step: this.step,
                price: price,
                averagePositionPrice: price,
                lots: lots || this.lotsSize,
                time: time,
                direction: this.enums.OrderDirection.ORDER_DIRECTION_SELL,
                quantity: {
                    units: this.tickerInfo.lot,
                },
                closed: false,
            });
        }

        backtestClosePosition(price) {
            for (const p of this.getOpenedPositions()) {
                if (!p.closed) {
                    p.closed = true;

                    this.backtestPositions.push({
                        id: this.genOrderId(),
                        parentId: p.id,
                        step: this.step,
                        price: price,
                        averagePositionPrice: price,
                        lots: p.lots || this.lotsSize,
                        quantity: {
                            units: this.tickerInfo.lot,
                        },
                        direction: p.direction === this.enums.OrderDirection.ORDER_DIRECTION_BUY ?
                            this.enums.OrderDirection.ORDER_DIRECTION_SELL :
                            this.enums.OrderDirection.ORDER_DIRECTION_BUY,
                        expectedYield: {
                            units: price.units - p.price.units,
                            nano: price.nano - p.price.nano,
                        },
                        closed: true,
                    });
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

        getOpenedPositions() {
            if (!this.hasBacktestOpenPositions()) {
                return [];
            }

            return this.backtestPositions.filter(position => !position.closed);
        }

        getLastOpenedPosition() {
            if (!this.hasBacktestOpenPositions()) {
                return undefined;
            }

            const openedPositions = this.getOpenedPositions();

            return openedPositions[openedPositions.length - 1];
        }

        getLastPosition() {
            if (!this.backtestPositions.length) {
                return undefined;
            }

            return this.backtestPositions[this.backtestPositions.length - 1];
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
