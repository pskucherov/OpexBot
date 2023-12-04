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

            this.subscribeTgEvents();
        }

        async subscribeTgEvents() {
            if (!this.tgBot) {
                return;
            }

            this.tgBot.onText(/продать вс[ёе]/igm, msg => {
                this.stopLossPosition();
            });
        }

        async sendTgEvents(type, data) {
            if (!this.tgBot) {
                return;
            }

            if (type === 'sellAll') {
                this.tgBot.sendMessage('Начата продажа портфеля.');
            }
        }

        /**
         * Метод, который решает покупать или нет.
         *
         * @returns {Boolean}
         */
        async decisionBuy() {
            this.decisionBuyPositionMessage = '';

            if (this.lastOrderTime &&
                (this.lastOrderTime + (this.orderTimeout * 1000)) > new Date().getTime()) {
                this.decisionBuyPositionMessage = 'decisionBuy: таймаут выставления заявки. False.';

                return false;
            }

            // Закрываем открытые ордера, которые были выставлены больше таймаута orderTimeout.
            if (this.hasOpenOrders()) {
                this.decisionBuyPositionMessage = 'decisionBuy: есть открытые ордера.';

                await this.closeAllOrders();

                return false;
            }

            if (this.hasBlockedPositions()) {
                this.decisionBuyPositionMessage = 'decisionBuy: есть блокированные позиции.';

                return false;
            }

            if (this.currentPositions?.[0] && !(await this.hasAllSyncedBalance())) {
                this.decisionBuyPositionMessage = 'Баланс позиций и портфолио не синхронизирован. False.';

                return false;
            }

            // Если есть позиции, и нет выставленных заявок.
            if ((await this.hasOpenPositions('share')) || this.hasOpenOrders()) {
                this.decisionBuyPositionMessage = 'decisionBuy: есть позиции';

                return false;
            }

            return true;
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

                this.decisionClosePositionMessage = 1;
                if (this.hasOpenOrders() && this.lastOrderTime &&
                    (this.lastOrderTime + (this.orderTimeout * 1000)) > new Date().getTime()) {
                    this.decisionClosePositionMessage = 'Таймаут выставления заявки. False.';

                    return false;
                }

                // Закрываем открытые ордера, которые были выставлены больше таймаута orderTimeout.
                if (this.hasOpenOrders()) {
                    await this.closeAllOrders();

                    this.decisionClosePositionMessage = 'Закрыли все позиции. False.';

                    return false;
                }

                if (this.hasBlockedPositions()) {
                    this.decisionClosePositionMessage = 'Есть заблокированные позиции. False.';

                    return false;
                }

                if (!(await this.hasAllSyncedBalance())) {
                    this.decisionClosePositionMessage = 'Баланс позиций и портфолио не синхронизирован. False.';

                    return false;
                }

                // Если есть позиции, и нет выставленных заявок.
                if ((await this.hasOpenPositions('share')) && !this.hasOpenOrders()) {
                    this.calcPortfolio();

                    this.decisionClosePositionMessage = 'Считаем TP и SL.';

                    // Если не для всех позиций проставлены цены, то не можем их закрывать.
                    // if (!this.totalNowSharesAmount || !this.currentTP || !this.currentSL) {
                    //     this.decisionClosePositionMessage = 'Проблемы с рассчётом TP и SL. False.';

                    //     return false;
                    // }

                    this.decisionClosePositionMessage = 'TP, SL ' + (this.totalNowSharesAmount >= this.currentTP ||
                        this.totalNowSharesAmount <= this.currentSL).toString();

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

        async closeAllPositions(type = 'TP') {
            if (this.currentPositions) {
                this.tgBot?.sendMessage(`Начата продажа портфеля по ${
                    type
                }.\r\nЦена портфеля: ${this.totalNowSharesAmount}`);

                // Срабатывает для любой позиции без привязки к instrumentId
                this.currentPositions.forEach(async p => {
                    if (p.instrumentType !== 'share') {
                        return;
                    }

                    const { positionVolume } = this.positionsProfit[p.instrumentId];
                    const price = this[p.instrumentId]?.lastPrice || p.currentPrice;

                    if (positionVolume > 0) {
                        // Закрываем long.
                        await this.sell(price, p.instrumentId, positionVolume, type);
                    } else if (positionVolume < 0) {
                        // Закрываем short.
                        await this.buy(price, p.instrumentId, Math.abs(positionVolume), type);
                    }
                });
            }
        }

        /**
         * Обрабатывает позиции с профитом.
         */
        async takeProfitPosition() {
            await this.closeAllPositions('TP');
        }

        /**
         * Обрабатывает позиции с убытком.
         */
        async stopLossPosition() {
            await this.closeAllPositions('SL');
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

        // async callBuy() {
        //     function shuffle(array) {
        //         let currentIndex = array.length,
        //             randomIndex;

        //         // While there remain elements to shuffle.
        //         while (currentIndex !== 0) {
        //             // Pick a remaining element.
        //             randomIndex = Math.floor(Math.random() * currentIndex);
        //             currentIndex--;

        //             // And swap it with the current element.
        //             [array[currentIndex], array[randomIndex]] = [
        //                 array[randomIndex], array[currentIndex]];
        //         }

        //         return array;
        //     }

        //     const newChips = this.blueChipsShares.find(f => f.instrumentId === 'BBG004PYF2N3');

        //     const { lastPrices } = await this.cb.getLastPrices([newChips.instrumentId]);

        //     // newChips.price = this.getPrice(lastPrices.find(l => l.instrumentId === newChips.instrumentId).price) * newChips.lot;
        //     const lot = 1;
        //     const { price } = lastPrices.find(l => l.instrumentId === newChips.instrumentId);

        //     await this.buy(price, newChips.instrumentId, lot, 'callBuy');
        // }
    }

    module.exports[name] = Bot;
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
