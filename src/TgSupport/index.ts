import { MoneyValue, Quotation } from 'tinkoff-sdk-grpc-js/dist/generated/common';

try {
    const { Backtest } = require('../Common/TsBacktest');

    const path = require('path');
    const name = __dirname.split(path.sep).pop();

    /**
     * Заготовка торгового робота.
     */
    class Bot extends Backtest {
        // instrument — торгует одним инструментом. portfolio — всем портфелем.
        static type = 'instrument';

        constructor(...args: any) { // eslint-disable-line
            super(...args);

            this.type = Bot.type;
            this.isPortfolio = true;
            this.name = name;

            (async () => {
                this.init();
                this.initAsync();
            })();
        }

        async sendBalanceMessage() {
            try {
                if (!this.allInstrumentsInfo || !this.currentPortfolio?.totalAmountPortfolio) {
                    this.balanceMessageTimeout = setTimeout(this.sendBalanceMessage.bind(this), 200);

                    return;
                }

                if (this.balanceMessageTimeout) {
                    clearTimeout(this.balanceMessageTimeout);
                }

                await this.updatePortfolio();
                await this.updatePositions();

                const {
                    expectedYield,
                    totalAmountPortfolio,
                } = this.currentPortfolio;

                const positions = this.currentPortfolio?.positions.map((p: { instrumentUid: string | number; }) => {
                    return {
                        ...p,
                        ...(this.allInstrumentsInfo?.[p.instrumentUid] || {}),
                    };
                });

                const textPositions: string[] = [];

                const totalPortfolio = this.getPrice(totalAmountPortfolio);

                textPositions.push('# ' + this.accountId);

                textPositions.push('Портфель: ' +
                    `${this.toMoneyString(totalPortfolio)} ${totalAmountPortfolio?.currency} `,
                );

                const yld = totalPortfolio * this.getPrice(expectedYield) / 100;

                textPositions.push(`Доходность: ${this.toMoneyString(yld && yld.toFixed(2))} (${this.getPrice(expectedYield).toFixed(2)}%)`);
                textPositions.push('');

                const names: { [key: string]: string; } = {
                    totalAmountShares: 'Акции',
                    totalAmountBonds: 'Облигации',
                    totalAmountEtf: 'ETF',
                    totalAmountCurrencies: 'Валюты',
                    totalAmountFutures: 'Фьючерсы',
                    totalAmountOptions: 'Опционы',
                    totalAmountSp: 'Структурные ноты',
                };

                Object.keys(names).map((p: string) => {
                    const price = this.getPrice(this.currentPortfolio[p]);

                    if (price) {
                        textPositions.push(`${names[p]}: ` +
                            `${this.toMoneyString(price)} ${this.currentPortfolio[p].currency}`,
                        );
                    }
                });
                textPositions.push('');
                positions
                    .filter((f: { name?: string; }) => Boolean(f.name))
                    .sort((a: { expectedYield: Quotation; }, b: { expectedYield: Quotation; }) => {
                        const yieldA = this.getPrice(a.expectedYield);
                        const yieldB = this.getPrice(b.expectedYield);

                        return yieldB - yieldA;
                    })
                    .map((p: {
                        name: string; ticker: string; expectedYield: MoneyValue; currency: string;
                        averagePositionPrice: MoneyValue; currentPrice: MoneyValue; quantity: Quotation;
                    }) => {
                        try {
                            textPositions.push(p.name + ` (${p.ticker})`);

                            // let lots = this.getPrice(p.quantity) / this.getPrice(p.lot);
                            // lots = lots < 1 ? lots : (Math.floor(lots * 1000) / 1000);

                            textPositions.push(
                                this.toMoneyString(this.getPrice(p.averagePositionPrice)) +
                                ' → ' + this.toMoneyString(this.getPrice(p.currentPrice)) + ` (x ${this.getPrice(p.quantity)} шт.)`,
                            );

                            if (p.expectedYield) {
                                const yld = this.getPrice(p.expectedYield);

                                textPositions.push('Доходность: ' + this.toMoneyString(yld) + ' ' + p.currency);
                            }

                            textPositions.push('');
                        } catch (e) {
                            console.log(e); // eslint-disable-line
                        }
                    });

                this.tgBot?.sendMessage(textPositions.join('\r\n'));
            } catch (e) {
                console.log(e); // eslint-disable-line
            }
        }

        async subscribeTgEvents() {
            try {
                if (!this.tgBot) {
                    return;
                }

                this.tgBot.onText(/счёт|счет/igm, async () => {
                    try {
                        await this.sendBalanceMessage();
                    } catch (e) {
                        console.log(e); // eslint-disable-line
                    }
                });
            } catch (e) {
                console.log(e); // eslint-disable-line
            }
        }

        start() {
            try {
                // Костыль, чтобы вотчер не триггерил несколько событий отправки.
                if (!this.startTimer || this.startTimer - Date.now() > 10000) {
                    this.sendBalanceMessage();
                }
                this.startTimer = Date.now();

                this.subscribeTgEvents();

                this.sendBalanceMessageInterval = setInterval(this.sendBalanceMessage.bind(this), 3600000);
            } catch (e) {
                console.log(e); // eslint-disable-line
            }
        }

        stop() {
            try {
                this.tgBot.removeTextListener(/счёт|счет/igm);

                if (this.sendBalanceMessageInterval) {
                    clearInterval(this.sendBalanceMessageInterval);
                }

                super.stop();
            } catch (e) {
                console.log(e); // eslint-disable-line
            }
        }
    }

    if (name) {
        module.exports[name] = Bot;
    }
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
