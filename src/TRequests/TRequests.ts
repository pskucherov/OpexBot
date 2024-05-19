// @ts-nocheck
/* eslint @typescript-eslint/no-explicit-any: 0 */
/* eslint @typescript-eslint/no-unused-vars: 0 */
/* eslint @typescript-eslint/ban-types: 0 */
/* eslint max-len: 0 */
/* eslint sonarjs/no-duplicate-string: 0 */
import { PortfolioResponse } from 'tinkoff-sdk-grpc-js/dist/generated/operations';

import { createSdk } from 'tinkoff-sdk-grpc-js';
import { MoneyValue, Quotation } from 'tinkoff-sdk-grpc-js/dist/generated/common';

import { mkDirByPathSync } from '../utils';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { OrderDirection, OrderExecutionReportStatus, OrderState } from 'tinkoff-sdk-grpc-js/dist/generated/orders';
import TelegramBot from 'node-telegram-bot-api';

export class TRequests {
    sdk?: ReturnType<typeof createSdk>;

    requests = {
        // lastMinutes: new Date().getMinutes(),
        // lastSeconds: new Date().getSeconds(),
        count: 0,
        limit: 50,

        instruments: {
            count: 0,
            limit: 200,
        },
        accounts: {
            count: 0,
            limit: 100,
        },
        operations: {
            count: 0,
            limit: 200,
        },
        orders: {
            count: 0,
            limit: 100,
        },
        marketData: {
            count: 0,
            limit: 600,
        },
        stopOrders: {
            count: 0,
            limit: 50,
        },
    };

    reqKeys = Object.keys(this.requests).filter(k => typeof this.requests[k] === 'object');

    constructor(sdk?: ReturnType<typeof createSdk>) {
        this.sdk = sdk;

        // Таймер подписки на события.
        this.subscribesTimer = 1000;
        this.subscribeDataUpdated = {};

        // this.instrumentsStack = Array(this.limits.instruments);
        // this.accountsStack = Array(this.limits.accounts);
        // this.operationsStack = Array(this.limits.operations);
        // this.ordersStack = Array(this.limits.orders);
        // this.marketDataStack = Array(this.limits.marketData);
        // this.stopOrdersStack = Array(this.limits.stopOrders);
        this.inited = false;

        this.asyncInit();
        setInterval(() => this.asyncInit(), 24 * 3600 * 1000);

        this.clean();
    }

    timer(time: number | undefined) {
        return new Promise(resolve => setTimeout(resolve, time));
    }

    async asyncInit() {
        await this.getAllInstruments();
        this.inited = true;
    }

    getSubscribeOptions() {
        const abortSubscribe = (_type: any, abort: () => void) => {
            if (!this.inProgress) {
                abort();
            }
        };

        return {
            signal: {
                addEventListener: abortSubscribe,
                removeEventListener: abortSubscribe,
            },
        };
    }

    subscribes(accountId) { // eslint-disable-line sonarjs/cognitive-complexity
        try {
            const { subscribes } = this.cb;

            // [
            //     'lastPrice',
            //     'orderbook',
            //     'candle',
            // ].forEach(name => {
            //     if (subscribes[name]) {
            //         setImmediate(async () => {
            //             const subscribeArr = subscribes[name]();

            //             let gen = subscribeArr[0]((async function* () {
            //                 try {
            //                     while (this.inProgress) {
            //                         await this.timer(this.subscribesTimer);

            //                         if (this.instrumentId) {
            //                             const instrumentId = typeof this.instrumentId === 'string' ? this.instrumentId.split(',') : this.instrumentId;

            //                             yield subscribeArr[1](instrumentId);
            //                         }
            //                     }

            //                     gen = null;
            //                 } catch (e) {
            //                     console.log(e); // eslint-disable-line no-console
            //                 }
            //             }).call(this), this.getSubscribeOptions());

            //             try {
            //                 for await (const data of gen) {
            //                     if (data[name]) {
            //                         this.subscribeDataUpdated[name] = true;
            //                         const isLastPrice = name === 'lastPrice';
            //                         const currentData = isLastPrice ? data[name].price : data[name];

            //                         this[data[name].instrumentId] || (this[data[name].instrumentId] = {});
            //                         this[data[name].instrumentId][name] = currentData;

            //                         if (!this.isPortfolio) {
            //                             this[name] = currentData;
            //                         }
            //                     }
            //                     if (!this.inProgress) {
            //                         gen = null;
            //                         break;
            //                     }
            //                 }
            //             } catch (e) {
            //                 console.log(e); // eslint-disable-line no-console

            //                 // Перезапускаем робота в случае ошибки.
            //                 // Ошибка сюда прилетит в случае обрыва соединения.
            //                 await this.restart(this.robotTimer + this.subscribesTimer);
            //             }
            //         });
            //     }
            // });

            ['orders', 'positions'].forEach(name => {
                if (subscribes[name]) {
                    setImmediate(async () => {
                        try {
                            let gen = subscribes[name]({
                                accounts: [accountId],
                            }, this.getSubscribeOptions());

                            for await (const data of gen) {
                                if (data.orderTrades) {
                                    if (!this.orderTrades) {
                                        this.orderTrades = [];
                                    }

                                    this.orderTrades.push(data.orderTrades);
                                    await this.updateOrders();
                                } else if (data.position && this.isPortfolio) {
                                    [
                                        'securities',

                                        // 'futures',
                                        // 'options',
                                    ].forEach(name => {
                                        try {
                                            if (!data.position[name] || !data.position[name].length) {
                                                return;
                                            }

                                            data.position[name].forEach(async (p: { instrumentId: any; instrumentType: any; }) => {
                                                const currentIndex = this.currentPositions.findIndex(c => {
                                                    return c.instrumentId === p.instrumentId &&
                                                        c.instrumentType === p.instrumentType;
                                                });

                                                if (currentIndex >= 0) {
                                                    this.currentPositions[currentIndex] = {
                                                        ...this.currentPositions[currentIndex],
                                                        ...p,
                                                    };
                                                } else {
                                                    await this.updatePositions();
                                                }
                                            });
                                        } catch (e) {
                                            console.log(e); // eslint-disable-line no-console
                                        }
                                    });

                                    await this.updateInstrumentId();

                                    // await this.updateOrdersInLog();
                                }

                                if (!this.inProgress) {
                                    gen = null;
                                    break;
                                }
                            }
                        } catch (e) {
                            console.log(e); // eslint-disable-line no-console

                            // Перезапускаем робота в случае ошибки.
                            // Ошибка сюда прилетит в случае обрыва соединения.
                            await this.restart(this.robotTimer + this.subscribesTimer);
                        }
                    });
                }
            });
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getAllInstruments() {
        try {
            if (this.allInstrumentsInfoTimeout && (this.allInstrumentsInfoTimeout + 10 * 60 * 1000) > Date.now()) {
                return this.allInstrumentsInfo;
            }

            if (!this.allInstrumentsInfo) {
                this.allInstrumentsInfo = {};
            } else if (!this.checkLimits('instruments')) {
                return this.allInstrumentsInfo;
            }

            const req = {
                instrumentStatus: this.sdk.InstrumentStatus.INSTRUMENT_STATUS_BASE,
            };

            const names = [
                'shares', 'bonds', 'futures',
                'etfs', 'options', 'currencies',
            ];

            for (let i = 0; i < names.length; i++) {
                try {
                    const name = names[i];

                    if (!this.checkLimits('instruments')) {
                        continue;
                    }

                    const { instruments } = await this.sdk.instruments[name](req);

                    if (instruments?.length) {
                        instruments.forEach(instrument => {
                            this.allInstrumentsInfo[instrument.uid] = instrument;
                        });
                    }
                } catch (e) {
                    console.log(e); // eslint-disable-line
                }
            }
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }

        this.allInstrumentsInfoTimeout = Date.now();

        return this.allInstrumentsInfo;
    }

    async getOpenOrders(accountId) {
        try {
            if (!this.checkLimits('orders')) {
                if (this.getOpenOrdersCache && this.getOpenOrdersTimeout && (this.getOpenOrdersTimeout + 1000) > Date.now()) {
                    return this.getOpenOrdersCache;
                }

                await this.timer(1000);
            }

            const { orders } = await this.sdk?.orders.getOrders({ accountId }) || {};

            this.allOrders = orders;

            this.getOpenOrdersCache = orders && orders.filter((o: { executionReportStatus: number; }) => [
                OrderExecutionReportStatus.EXECUTION_REPORT_STATUS_NEW,
                OrderExecutionReportStatus.EXECUTION_REPORT_STATUS_PARTIALLYFILL,
            ].includes(o.executionReportStatus));

            return this.getOpenOrdersCache;
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }

        this.getOpenOrdersTimeout = Date.now();

        return this.getOpenOrdersCache;
    }

    async getPortfolio(accountId) {
        try {
            if (!this.checkLimits('operations')) {
                if (this.getPortfolioTimeout && (this.getPortfolioTimeout + 1000) > Date.now()) {
                    return this.getPortfolioCache;
                }

                await this.timer(1000);
            }

            this.getPortfolioTimeout = Date.now();
            this.getPortfolioCache = accountId && await this.sdk?.operations.getPortfolio({ accountId });

            return this.getPortfolioCache;
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async updateOrders() {
        this.currentOrders = await this.getOpenOrders();
        this.ordersInited = true;
    }

    clean() {
        setInterval(() => {
            this.requests.count = 0;
        }, 1000);

        setInterval(() => {
            // this.requests.lastMinutes = new Date().getMinutes();
            for (let i = 0; i < this.reqKeys.length; i++) {
                if (this.requests[this.reqKeys[i]].count) {
                    this.requests[this.reqKeys[i]].count = 0;
                }
            }
        }, 60000);
    }

    checkLimits(type: string) {
        try {
            if (this.requests.count >= this.requests.limit) {
                throw `RPS limit ${type} ${this.requests.count} / ${this.requests.limit}`;
            }

            if (this.requests[type].count >= this.requests[type].limit) {
                throw `${type} limit ${this.requests[type].count} / ${this.requests[type].limit}`;
            }

            ++this.requests.count;
            ++this.requests[type].count;

            return true;
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getPositions(accountId) {
        try {
            if (!accountId) {
                throw 'Укажите accountId';
            }

            if (!this.checkLimits('operations')) {
                if (this.getPositionsTimeout && (this.getPositionsTimeout + 1000) > Date.now()) {
                    return this.getPositionsCache;
                }

                await this.timer(1000);
            }

            this.getPositionsTimeout = Date.now();
            this.getPositionsCache = accountId && await this.sdk?.operations.getPositions({ accountId });

            return this.getPositionsCache;
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }
}
