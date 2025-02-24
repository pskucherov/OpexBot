import { MoneyValue, Quotation } from 'tinkoff-sdk-grpc-js/dist/generated/common';
import {
    OrderDirection,
    OrderStateStreamResponse_OrderState, // eslint-disable-line camelcase
} from 'tinkoff-sdk-grpc-js/dist/generated/orders';

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

        async sendBalanceMessage(
            //props?: { sendEmpty?: boolean; } | undefined
        ) {
            // const {
            //     sendEmpty,
            // } = props || {};

            try {
                if (!this.allInstrumentsInfo ||
                    !this.currentPortfolio ||
                    !this.currentPortfolio?.totalAmountPortfolio
                ) {
                    this.balanceMessageTimeout = setTimeout(this.sendBalanceMessage.bind(this), 200);

                    return;
                }

                if (this.balanceMessageTimeout) {
                    clearTimeout(this.balanceMessageTimeout);
                }

                // this.restartBalanceInterval();

                // if (sendEmpty) {
                //     console.log(1);
                // }

                await this.updatePortfolio();
                await this.updatePositions();

                const {
                    expectedYield,
                    totalAmountPortfolio,
                } = this.currentPortfolio;

                const positions = this.currentPortfolio?.positions?.map((p: { instrumentUid: string | number; }) => {
                    return {
                        ...p,
                        ...(this.allInstrumentsInfo?.[p.instrumentUid] || {}),
                    };
                }) || [];

                const textPositions: string[] = [];

                const totalPortfolio = this.roundPrice(totalAmountPortfolio);

                textPositions.push('# ' + this.accountId);

                textPositions.push('Портфель: ' +
                    `${this.toMoneyString(totalPortfolio)} ${totalAmountPortfolio?.currency} `,
                );

                const yld = totalPortfolio * this.roundPrice(expectedYield) / 100;

                textPositions.push(`Доходность: ${this.toMoneyString(yld && yld.toFixed(2))
                    } (${this.roundPrice(expectedYield).toFixed(2)}%)`);
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
                    const price = this.roundPrice(this.currentPortfolio[p]);

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

                            // let lots = this.roundPrice(p.quantity) / this.roundPrice(p.lot);
                            // lots = lots < 1 ? lots : (Math.floor(lots * 1000) / 1000);

                            textPositions.push(
                                this.toMoneyString(this.roundPrice(p.averagePositionPrice)) +
                                ' → ' + this.toMoneyString(this.roundPrice(p.currentPrice)) +
                                ` (x ${this.roundPrice(p.quantity)} шт.)`,
                            );

                            if (p.expectedYield) {
                                const yld = this.roundPrice(p.expectedYield);

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
                        await this.sendBalanceMessage(

                            //     {
                            //     sendEmpty: true,
                            // }
                        );
                    } catch (e) {
                        console.log(e); // eslint-disable-line
                    }
                });
            } catch (e) {
                console.log(e); // eslint-disable-line
            }
        }

        restartBalanceInterval() {
            if (this.sendBalanceMessageInterval) {
                clearInterval(this.sendBalanceMessageInterval);
            }

            this.sendBalanceMessageInterval = setInterval(this.sendBalanceMessage.bind(this), 3600000);
        }

        async onTradeData(data: OrderStateStreamResponse_OrderState) { // eslint-disable-line camelcase
            try {
                if (this.tgBot?.sendMessage) {
                    const textArr: string[] = [];

                    const {
                        direction,
                        instrumentUid,
                        trades,
                    } = data;

                    let sumQ = 0;

                    // let sumP = 0;
                    let all = 0;

                    await this.syncPos();

                    let sumYield = 0;
                    let sumPriceYield = 0;

                    trades.forEach(t => {
                        try {
                            const info = this.allInstrumentsInfo?.[instrumentUid];
                            const {
                                price,
                                quantity,
                            } = t;

                            let text;

                            const {
                                quantity: quantityPositionBase,
                                averagePositionPriceFifo,
                            } = this.currentPositions.find(
                                (p: { instrumentUid: string; }) => p.instrumentUid === instrumentUid,
                            ) || {};

                            const quantityPos = this.roundPrice(quantityPositionBase);
                            const posPrice = this.roundPrice(averagePositionPriceFifo);

                            const isBuyPos = this.getPrice(quantityPos) > 0;
                            const isBuyOrder = direction === OrderDirection.ORDER_DIRECTION_BUY;

                            const isCloseTrade = isBuyOrder && !isBuyPos ||
                                !isBuyOrder && isBuyPos;

                            if (isBuyOrder) {
                                text = 'Покупка';
                            } else {
                                text = 'Продажа';
                            }

                            const orderPrice = this.roundPrice(price);

                            text += ` ${info.ticker} по цене ${orderPrice} (x ${quantity} шт.).`;

                            if (quantity > 1) {
                                text += ` на сумму ${this.toMoneyString(orderPrice * quantity)}.`;
                            }

                            if (posPrice && isCloseTrade) {
                                // posPrice - fifo позиция.
                                // price - order позиция.
                                const currentYieldSign = !isBuyOrder ? // Закрытие long
                                    orderPrice >= posPrice ? 1 : -1 :
                                    orderPrice <= posPrice ? 1 : -1;

                                const currentPriceYield = currentYieldSign *
                                    Math.abs(this.roundPrice(price) - posPrice);
                                const currentYield = currentYieldSign *
                                    Math.abs(currentPriceYield / posPrice) * 100;

                                if (currentYield) {
                                    sumYield += currentYield;
                                    sumPriceYield += currentPriceYield;
                                    text += ' Доходность сделки: ' + this.toMoneyString(
                                        currentPriceYield * quantity,
                                    ) + ` (${this.toMoneyString(currentYield)}%).`;
                                }
                            }

                            textArr.push(text);
                            sumQ += quantity;

                            // sumP += this.roundPrice(price);
                            all += this.roundPrice(price) * quantity;
                        } catch (e) {
                            console.log(e); // eslint-disable-line
                        }
                    });

                    if (textArr.length > 1) {
                        let currentText = textArr.join('\r\n') + '\r\n' + `Всего ${sumQ} шт. на сумму ${this.toMoneyString(all)}.`;

                        if (sumYield) {
                            currentText += ` Совокупная доходность: ${this.toMoneyString(sumPriceYield)} (${this.toMoneyString(sumYield)}%).`;
                        }

                        this.tgBot?.sendMessage(currentText);
                    } else {
                        this.tgBot?.sendMessage(textArr[0]);
                    }
                }
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

                super.start();

                this.onTradeDataBinded = this.onTradeData.bind(this);
                this.eventEmitter.on('subscribe:orderTrades:' + this.accountId, this.onTradeDataBinded);
            } catch (e) {
                console.log(e); // eslint-disable-line
            }
        }

        stop() {
            try {
                this.tgBot?.removeTextListener(/счёт|счет/igm);

                this.eventEmitter.off('subscribe:orderTrades:' + this.accountId, this.onTradeDataBinded);

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
