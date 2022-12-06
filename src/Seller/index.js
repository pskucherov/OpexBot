const { throws } = require('assert');
const { parse } = require('path');

try {
    const { Backtest } = require('../Common/Backtest');

    const path = require('path');
    const name = __dirname.split(path.sep).pop();

    /**
     * Заготовка торгового робота.
     */
    class Bot extends Backtest {
        // instrument — торгует одним инструментом. portfolio — всем портфелем.
        static type = 'portfolio';

        constructor(...args) {
            super(...args);

            this.type = Bot.type;
            this.isPortfolio = true;
            this.name = name;
        }

        /**
         * Метод, который решает покупать или нет.
         *
         * @returns {Boolean}
         */
        async decisionBuy() {
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
            try {
                this.resetCalculatedPortfolioParams();

                if (this.hasOpenOrders() && this.lastOrderTime &&
                    (this.lastOrderTime + (this.orderTimeout * 1000)) > new Date().getTime()) {
                    return false;
                }

                // Закрываем открытые ордера, которые были выставлены больше таймаута orderTimeout.
                if (this.hasOpenOrders()) {
                    await this.closeAllOrders();

                    return false;
                }

                if (this.hasBlockedPositions()) {
                    return false;
                }

                if (!(await this.hasAllSyncedBalance())) {
                    return false;
                }

                // Если есть позиции, и нет выставленных заявок.
                if ((await this.hasOpenPositions('share')) && !this.hasOpenOrders()) {
                    this.calcPortfolio();

                    // Если не для всех позиций проставлены цены, то не можем их закрывать.
                    if (!this.totalNowSharesAmount || !this.currentTP || !this.currentSL) {
                        return false;
                    }

                    // const totalAmountShares = this.getPrice(this.currentPortfolio.totalAmountShares);
                    // Цена достигла TP или SL, тогда закрываем позицию.
                    return this.totalNowSharesAmount >= this.currentTP ||
                        this.totalNowSharesAmount <= this.currentSL;
                }

                return false;
            } catch (e) {
                console.log(e); // eslint-disable-line
            }
        }

        /**
         * Обрабатывает позиции с профитом.
         */
        async takeProfitPosition() {
            if (this.currentPositions) {
                // Срабатывает для любой позиции без привязки к figi
                this.currentPositions.forEach(async p => {
                    if (p.instrumentType !== 'share') {
                        return;
                    }

                    const { positionVolume } = this.positionsProfit[p.figi];
                    const price = this[p.figi]?.lastPrice || p.currentPrice;

                    if (positionVolume > 0) {
                        // Закрываем long.
                        await this.sell(price, p.figi, positionVolume, 'TP');
                    } else if (positionVolume < 0) {
                        // Закрываем short.
                        await this.buy(price, p.figi, Math.abs(positionVolume), 'TP');
                    }
                });
            }
        }

        /**
         * Обрабатывает позиции с убытком.
         */
        async stopLossPosition() {
            // if (this.backtest) {
            //     this.backtestPositions.filter(p => !p.closed).forEach(async p => {
            //         if (this.getPrice(this.lastPrice) >= this.getPrice(this.getTakeProfitPrice(1, p.price))) {
            //             // await this.sell(this.lastPrice, this.figi, this.lotsSize, 'TP');
            //         }
            //     });
            // } else

            if (this.currentPositions) {
                // Срабатывает для любой позиции без привязки к figi
                this.currentPositions.forEach(async p => {
                    if (p.instrumentType !== 'share') {
                        return;
                    }

                    const { positionVolume } = this.positionsProfit[p.figi];
                    const price = this[p.figi]?.lastPrice || p.currentPrice;

                    if (positionVolume > 0) {
                        // Закрываем long.
                        await this.sell(price, p.figi, positionVolume, 'SL');
                    } else if (positionVolume < 0) {
                        // Закрываем short.
                        await this.buy(price, p.figi, Math.abs(positionVolume), 'SL');
                    }
                });
            }
        }

        /**
         * Закрывает позиции.
         */
        async closePosition() {
            try {
                if (this.totalNowSharesAmount >= this.currentTP) {
                    await this.takeProfitPosition();
                } else if (this.totalNowSharesAmount <= this.currentSL) {
                    await this.stopLossPosition();
                }
            } catch (e) {
                console.log(e); // eslint-disable-line
            }
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
