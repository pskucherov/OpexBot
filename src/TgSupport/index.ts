import { MoneyValue } from 'tinkofftradingbotconnector/node_modules/tinkoff-sdk-grpc-js/dist/generated/common';

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

            this.subscribeTgEvents();
        }

        async sendBalanceMessage() {
            try {
                if (!this.allInstrumentsInfo || !this.currentPortfolio) {
                    this.balanceMessageTimeout = setTimeout(() => this.sendBalanceMessage(), 200);

                    return;
                }

                if (this.balanceMessageTimeout) {
                    clearTimeout(this.balanceMessageTimeout);
                }

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

                textPositions.push(`**Доходность: ${this.getPrice(expectedYield)}%**`);
                textPositions.push('');
                textPositions.push('Портфель: ' +
                    `${this.toMoneyString(this.getPrice(totalAmountPortfolio))} ${totalAmountPortfolio?.currency} `,
                );
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
                    .map((p: { name: string; ticker: string; expectedYield: MoneyValue; currency: string; }) => {
                        textPositions.push(p.name + ` (${p.ticker}) ` + this.toMoneyString(this.getPrice(p.expectedYield)) + ' ' + p.currency);
                    });

                this.tgBot.sendMessage(textPositions.join('\r\n'));
            } catch (e) {
                console.log(e); // eslint-disable-line
            }
        }

        async subscribeTgEvents() {
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
        }

        start() {
            // Переопределяем start, чтобы не выполнялась подписка и прочее получение информации.
            this.sendBalanceMessage();

            this.sendBalanceMessageInterval = setInterval(this.sendBalanceMessage, 3600000);
        }

        stop() {
            super.stop();

            if (this.sendBalanceMessageInterval) {
                clearInterval(this.sendBalanceMessageInterval);
            }
        }
    }

    if (name) {
        module.exports[name] = Bot;
    }
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
