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
                // Закрываем открытые ордера.
                if (this.hasOpenOrders()) {
                    this.closeAllOrders();

                    return false;
                }

                // Если есть позиции, и нет выставленных заявок.
                if ((await this.hasOpenPositions()) && !this.hasOpenOrders()) {
                    // Если не для всех позиций проставлены цены, то не можем их закрывать.
                    // if (!this.currentPortfolio.positions
                    //     .every(p => Boolean(this[p.figi] && this[p.figi].lastPrice))
                    // ) {
                    //     return false;
                    // }

                    this.calcPortfolio();

                    const totalAmountShares = this.getPrice(this.currentPortfolio.totalAmountShares);

                    // Цена достигла TP или SL, тогда закрываем позицию.
                    return totalAmountShares >= this.currentTP ||
                        totalAmountShares <= this.currentSL;
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
            // if (this.backtest) {
            //     this.backtestPositions.filter(p => !p.closed).forEach(async p => {
            //         if (this.getPrice(this.lastPrice) >= this.getPrice(this.getTakeProfitPrice(1, p.price))) {
            //             // await this.sell(this.lastPrice, this.figi, this.lotsSize, 'TP');
            //         }
            //     });
            // } else
            if (this.currentPortfolio) {
                // Срабатывает для любой позиции без привязки к figi
                this.currentPortfolio.positions.forEach(async p => {
                    const { positionVolume } = this.positionsProfit[p.figi];

                    if (positionVolume > 0) {
                        // Закрываем long.
                        await this.sell(p.currentPrice, p.figi, positionVolume, 'TP');
                    } else if (positionVolume < 0) {
                        // Закрываем short.
                        await this.buy(p.currentPrice, p.figi, positionVolume, 'TP');
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
            if (this.currentPortfolio) {
                // Срабатывает для любой позиции без привязки к figi
                this.currentPortfolio.positions.forEach(async p => {
                    const { positionVolume } = this.positionsProfit[p.figi];

                    if (positionVolume > 0) {
                        // Закрываем long.
                        await this.sell(p.currentPrice, p.figi, positionVolume, 'SL');
                    } else if (positionVolume < 0) {
                        // Закрываем short.
                        await this.buy(p.currentPrice, p.figi, positionVolume, 'SL');
                    }
                });
            }
        }

        /**
         * Закрывает позиции.
         */
        async closePosition() {
            try {
                const totalAmountShares = this.getPrice(this.currentPortfolio.totalAmountShares);

                if (totalAmountShares >= this.currentTP) {
                    await this.takeProfitPosition();
                } else if (totalAmountShares <= this.currentSL) {
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

        /**
         * Сохраняет основные параметры расчётов по портфелю,
         * чтобы не пересчитывать их при выставлении ордеров.
         *
         * @param {*} params
         * @returns
         */
        saveCalculatedPortfolioParams(params) {
            const {
                expectedYield,
                currentTP,
                currentSL,
            } = params;

            this.expectedYield = expectedYield;
            this.currentTP = currentTP;
            this.currentSL = currentSL;
            this.positionsProfit = params;

            return params;
        }

        /**
         * Рассчитывает параметры торговли для портфеля.
         *
         * @param {?String} type — тип инструментов, для которых нужно посчитать.
         * @returns
         */
        calcPortfolio(type = 'share') {
            const calcParams = Bot.calcPortfolio(this.currentPortfolio, {
                volume: this.volume,
                takeProfit: this.takeProfit,
                stopLoss: this.stopLoss,
            }, type);

            this.saveCalculatedPortfolioParams(calcParams);

            return calcParams;
        }

        static calcPortfolio(portfolio, settings, type = 'share') {
            try {
                if (!portfolio?.positions?.length) {
                    return {};
                }

                const { totalStartSharesAmount, expectedYield } = portfolio.positions.reduce((prev, current) => {
                    if (current?.instrumentType !== type) {
                        return;
                    }

                    prev.totalStartSharesAmount += this.getPrice(current.averagePositionPrice) *
                        Math.abs(this.getPrice(current.quantity));
                    prev.expectedYield += this.getPrice(current.expectedYield);

                    return prev;
                }, {
                    totalStartSharesAmount: 0,
                    expectedYield: 0,
                });

                // setSharesPrice((expectedYield < 0 ? '-' : '') + getYield(totalStartSharesAmount, expectedYield));

                const positionsProfit = portfolio?.positions?.reduce((prev, p) => {
                    prev[p.figi] = {
                        // Для неполной позиции не применяем.
                        // Берём часть позиции в соответствии с настройками, но не менее одной позиции.
                        positionVolume: !p.quantityLots.units && p.quantityLots.nano ? 0 :
                            Math.max(parseInt(p.quantityLots.units * settings.volume, 10), 1),
                    };

                    if (prev[p.figi].positionVolume) {
                        // const lotSize = Math.abs(parseInt(p.quantity.units / p.quantityLots.units));
                        prev.currentTP = totalStartSharesAmount + totalStartSharesAmount * settings.takeProfit;
                        prev.currentSL = totalStartSharesAmount - totalStartSharesAmount * settings.stopLoss;
                    }

                    return prev;
                }, {
                    currentTP: 0,
                    currentSL: 0,
                });

                return {
                    ...positionsProfit,
                    totalStartSharesAmount,
                    expectedYield,
                };
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }
        }
    }

    module.exports[name] = Bot;
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
