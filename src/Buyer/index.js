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
            this.isPortfolio = true;
            this.name = name;
        }

        /**
         * Метод, который решает покупать или нет.
         *
         * @returns {Boolean}
         */
        async decisionBuy() {
            try {
                this.resetCalculatedPortfolioParams();

                if (this.hasOpenOrders() && this.lastOrderTime &&
                    (this.lastOrderTime + (this.orderTimeout * 1000)) > new Date().getTime()) {
                    return false;
                }

                // Закрываем открытые ордера, которые были выставлены больше минуты назад.
                if (this.hasOpenOrders()) {
                    //await this.closeAllOrders();

                    return false;
                }

                if (this.hasBlockedPositions()) {
                    return false;
                }

                return !(await this.hasOpenPositions('share'));
            } catch (e) {
                console.log(e); // eslint-disable-line
            }
        }

        /**
         * Метод, который решает продавать или нет.
         *
         * @returns {Boolean}
         */
        async decisionSell() {
            return false;
        }

        async buy() {
            function getRandomInt(max) {
                return Math.floor(Math.random() * max);
            }

            function shuffle(array) {
                let currentIndex = array.length,
                    randomIndex;

                // While there remain elements to shuffle.
                while (currentIndex !== 0) {
                    // Pick a remaining element.
                    randomIndex = Math.floor(Math.random() * currentIndex);
                    currentIndex--;

                    // And swap it with the current element.
                    [array[currentIndex], array[randomIndex]] = [
                        array[randomIndex], array[currentIndex]];
                }

                return array;
            }

            const { lastPrices } = await this.cb.getLastPrices(this.blueChipsShares.map(f => f.figi));
            const newChips = shuffle(this.blueChipsShares)[0];

            newChips.price = this.getPrice(lastPrices.find(l => l.figi === newChips.figi).price) * newChips.lot;
            const lot = getRandomInt(4) + 1;
        }

        async sell() {
        }

        /**
         * Решает про вызов метода закрытия позиций.
         * @returns {Boolean}
         */
        async decisionClosePosition() {
            // Если есть позиции, то пробуем закрыт сделку по профиту или SL.
            // return (await this.hasOpenPositions()) && !this.hasOpenOrders();
            return false;
        }

        /**
         * Обрабатывает позиции с профитом.
         */
        async takeProfitPosition() {
            if (this.backtest) {
                this.backtestPositions.filter(p => !p.closed).forEach(async p => {
                    if (this.getPrice(this.lastPrice) >= this.getPrice(this.getTakeProfitPrice(1, p.price))) {
                        // await this.sell(this.lastPrice, this.figi, this.lotsSize, 'TP');
                    }
                });
            } else if (this.currentPortfolio && this.takeProfit) {
                // Срабатывает для любой позиции без привязки к figi
                this.currentPortfolio.positions.forEach(async p => {
                    // let lots = Number(p.quantityLots.units / 2);

                    // if (lots < 1) {
                    //     lots = 1;
                    // }

                    //  await this.sell(this.getTakeProfitPrice(1, p.averagePositionPrice), p.figi, lots, 'TP');
                });
            }
        }

        /**
         * Обрабатывает позиции с убытком.
         */
        async stopLossPosition() {
            // Срабатывает для любой позиции без привязки к figi
            if (this.backtest) {
                if (this.getPrice(this.lastPrice) < this.getPrice(this.getTakeProfitPrice(1, this.lastPrice))) {
                    // await this.sell(this.lastPrice, this.figi, this.lotsSize, 'SL');
                }
            } else if (this.currentPortfolio && this.stopLoss) {
                // Срабатывает для любой позиции без привязки к figi
                this.currentPortfolio.positions.forEach(async p => {
                    // let lots = Number(p.quantityLots.units / 2);

                    // if (lots < 1) {
                    //     lots = 1;
                    // }

                    // await this.sell(this.getStopLossPrice(1, p.averagePositionPrice), p.figi, lots, 'SL');
                });
            }
        }

        /**
         * Закрывает позиции.
         */
        async closePosition() {
            // await this.takeProfitPosition();
            // await this.stopLossPosition();
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
