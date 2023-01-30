try {
    const { Backtest } = require('../Common/Backtest');

    const path = require('path');
    const name = __dirname.split(path.sep).pop();

    /**
     * Робот торгующий по линиям поддержки и сопротивления.
     */
    class Bot extends Backtest {
        // instrument — торгует одним инструментом. portfolio — всем портфелем.
        static type = 'instrument';

        constructor(...args) {
            super(...args);
            this.name = name;
        }

        /**
         * Метод, который решает покупать или нет.
         *
         * @returns {Boolean}
         */
        async decisionBuy() {
            if (!this.support || !this.lastPrice) {
                return false;
            }

            if ((!this.backtest || this.step > 1) &&
                !(await this.hasOpenPositions()) &&
                !this.hasOpenOrders()
            ) {
                return this.getPrice(this.lastPrice) <= this.getPrice(this.support);
            }

            return false;
        }

        /**
         * Метод, который решает продавать или нет.
         *
         * @returns {Boolean}
         */
        async decisionSell() {
            return false;
        }

        /**
         * Решает про вызов метода закрытия позиций.
         * @returns {Boolean}
         */
        async decisionClosePosition() {
            // Если есть позиции, то пробуем закрыт сделку по профиту или SL.
            return (await this.hasOpenPositions()) && !this.hasOpenOrders();
        }

        /**
         * Обрабатывает позиции с профитом.
         */
        async takeProfitPosition() {
            if (this.backtest) {
                this.backtestPositions.filter(p => !p.closed).forEach(async p => {
                    if (this.getPrice(this.lastPrice) >= this.getPrice(this.getTakeProfitPrice(1, p.price))) {
                        await this.sell(this.lastPrice, this.figi, this.lotsSize, 'TP');
                    }
                });
            } else if (this.currentPortfolio && this.takeProfit) {
                // Срабатывает для любой позиции без привязки к figi
                this.currentPortfolio.positions.forEach(async p => {
                    await this.sell(this.getTakeProfitPrice(1, p.averagePositionPrice), p.figi, p.quantityLots.units, 'TP');
                });
            }
        }

        /**
         * Обрабатывает позиции с убытком.
         */
        async stopLossPosition() {
            // Срабатывает для любой позиции без привязки к figi
            if (this.backtest) {
                this.backtestPositions.filter(p => !p.closed).forEach(async p => {
                    if (this.getPrice(this.lastPrice) < this.getPrice(this.getStopLossPrice(1, p.price))) {
                        await this.sell(this.lastPrice, this.figi, this.lotsSize, 'SL');
                    }
                });
            } else if (this.currentPortfolio && this.stopLoss) {
                // Срабатывает для любой позиции без привязки к figi
                this.currentPortfolio.positions.forEach(async p => {
                    await this.sell(this.getStopLossPrice(1, p.averagePositionPrice), p.figi, p.quantityLots.units, 'SL');
                });
            }
        }

        /**
         * Закрывает позиции.
         */
        async closePosition() {
            await this.takeProfitPosition();
            await this.stopLossPosition();
        }

        /**
         * Выполняется при остановке робота из UI.
         * Можно добавить закрытие всех позиций или обработку статистики.
         */
        stop() {
            super.stop();
        }
    }

    module.exports[name] = Bot;
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
