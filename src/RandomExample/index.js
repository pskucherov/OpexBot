try {
    const { Backtest } = require('../Common/Backtest');

    /**
     * Торговый робот без логики со случайным срабатыванием.
     * Работает только на покупку, дальше ждёт исполнения заявки.
     * После исполнения заявки ждёт выхода по TP или SP.
     */
    class RandomExample extends Backtest {
        constructor(...args) {
            super(...args);
            this.name = 'RandomExample';
        }

        // Покупаем, если известна последняя цена,
        // нет открытых позиций и заявок.
        async decisionBuy() {
            if (this.lastPrice &&
                (!this.backtest || this.step > 10) &&
                !(await this.hasOpenPositions()) &&
                !this.hasOpenOrders()
            ) {
                return Math.floor(Math.random() * 100) > 80;
            }

            return false;
        }

        decisionSell() {
            // Робот работает только на покупку.
            return false;
        }

        async takeProfitPosition() {
            if (this.currentPortfolio && this.takeProfit) {
                this.currentPortfolio.positions.forEach(async p => {
                    await this.sell(this.getTakeProfitPrice(1, p.averagePositionPrice), p.figi, p.quantityLots.units, 'TP');

                    // const currentYield = this.getPrice(p.expectedYield);
                    // const averagePrice = this.getPrice(p.averagePositionPrice);
                    // if ((averagePrice * this.takeProfit) > currentYield) {
                    //     console.log(p);
                    //     console.log('currentYield', currentYield);
                    //     console.log('averagePositionPrice', averagePrice);
                    //     console.log('currentPrice', p.currentPrice);
                    //     console.log('if', (averagePrice * this.takeProfit));

                    //     await this.sell(p.currentPrice, p.figi, p.quantityLots.units, 'TP');
                    // }
                });
            }
        }

        async stopLossPosition() {
            if (this.currentPortfolio && this.stopLoss) {
                this.currentPortfolio.positions.forEach(async p => {
                    const currentYield = this.getPrice(p.expectedYield);
                    const averagePrice = this.getPrice(p.averagePositionPrice);

                    if (averagePrice * (1 - this.stopLoss) > currentYield) {
                        await this.sell(p.currentPrice, p.figi, p.quantityLots.units, 'SL');
                    }
                });
            }
        }

        async decisionClosePosition() {
            // Если есть позиции и нет открытых заявок, то пробуем закрыт сделку по профиту или SL.
            return (await this.hasOpenPositions()) && !this.hasOpenOrders();
        }

        async closePosition() {
            await this.takeProfitPosition();
        }

        stop() {
            super.stop();
            console.log('stop'); // eslint-disable-line no-console
        }
    }

    module.exports.RandomExample = RandomExample;
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
