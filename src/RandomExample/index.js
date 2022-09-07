try {
    const { Backtest } = require('../Common/Backtest');

    const path = require('path');
    const name = __dirname.split(path.sep).pop();

    /**
     * Торговый робот без логики со случайным срабатыванием.
     * Работает только на покупку, дальше ждёт исполнения заявки.
     * После исполнения заявки ждёт выхода по TP или SP.
     */
    class Bot extends Backtest {
        constructor(...args) {
            super(...args);
            this.name = name;
        }

        // Покупаем, если известна последняя цена,
        // нет открытых позиций и заявок.
        async decisionBuy() {
            try {
                if (this.lastPrice &&
                    (!this.backtest || this.step > 1) &&
                    !(await this.hasOpenPositions()) &&
                    !this.hasOpenOrders()
                ) {
                    return Math.floor(Math.random() * 100) > 80;
                }

                return false;
            } catch (e) {
                console.log('decisionBuy error', e); // eslint-disable-line no-console
            }
        }

        decisionSell() {
            // Робот работает только на покупку.
            return false;
        }

        async takeProfitPosition() {
            try {
                if (this.backtest) {
                    this.backtestPositions.filter(p => !p.closed).forEach(async p => {
                        if (this.getPrice(this.lastPrice) >= this.getPrice(this.getTakeProfitPrice(1, p.price))) {
                            await this.sell(this.lastPrice, this.figi, this.lotsSize, 'TP');
                        }
                    });
                } else if (this.currentPortfolio && this.takeProfit) {
                    // Срабатывает для любой позиции без привязки к figi
                    this.currentPortfolio.positions.forEach(async p => {
                        if (p.quantityLots?.units) {
                            let lots = Number(p.quantityLots.units / 2);

                            if (lots < 1) {
                                lots = 1;
                            }

                            await this.sell(this.getTakeProfitPrice(1, p.averagePositionPrice), p.figi, lots, 'TP');
                        } else {
                            console.log('takeProfitPosition empty quantityLots.units');
                        }
                    });
                }
            } catch (e) {
                console.log('takeProfitPosition', e);
            }
        }

        async stopLossPosition() {
            // Срабатывает для любой позиции без привязки к figi
            if (this.backtest) {
                if (this.getPrice(this.lastPrice) < this.getPrice(this.getTakeProfitPrice(1, this.lastPrice))) {
                    await this.sell(this.lastPrice, this.figi, this.lotsSize, 'SL');
                }
            } else if (this.currentPortfolio && this.stopLoss) {
                // Срабатывает для любой позиции без привязки к figi
                this.currentPortfolio.positions.forEach(async p => {
                    let lots = Number(p.quantityLots.units / 2);

                    if (lots < 1) {
                        lots = 1;
                    }

                    await this.sell(this.getStopLossPrice(1, p.averagePositionPrice), p.figi, lots, 'SL');
                });
            }
        }

        async decisionClosePosition() {
            // Если есть позиции, то пробуем закрыт сделку по профиту или SL.
            return (await this.hasOpenPositions()) && !this.hasOpenOrders(); // < 2; // Открытых заявок должно быть не меньше двух, одна на TP, другая на SL.
        }

        async closePosition() {
            await this.takeProfitPosition();

            // await this.stopLossPosition();
        }

        stop() {
            super.stop();
        }
    }

    module.exports[name] = Bot;
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
