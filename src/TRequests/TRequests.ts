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
import { MarketDataRequest, SubscriptionAction, TradeSourceType } from 'tinkoff-sdk-grpc-js/dist/generated/marketdata';
import { Common } from '../Common/TsCommon';
import { Share } from 'tinkoff-sdk-grpc-js/dist/generated/instruments';

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
        this.subscribesTimer = 150;
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
            // console.log('abort', this.inProgress);
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

    getAllTrades(uid) {
        return this.allLastTrades?.[uid];
    }

    getAllTradesAggregatedStat(uid) {
        const data = this.getAllTradesAggregated(uid);

        if (!data) {
            return;
        }

        /*
          {
            figi: 'BBG004730N88',
            direction: 2,
            price: { units: 311, nano: 70000000 },
            quantity: 2,
            time: 2024-06-04T09:38:46.843Z,
            instrumentUid: 'e6123145-9665-43e0-8413-cd61b8aa9b13',
            countTrades: 1,
            priceDelta: -0.009999999999990905,
            priceDeltaPerc: -0.00003214710515315172
          },
          {
            figi: 'BBG004730N88',
            direction: 1,
            price: { units: 311, nano: 80000000 },
            quantity: 5,
            time: 2024-06-04T09:38:44.811Z,
            instrumentUid: 'e6123145-9665-43e0-8413-cd61b8aa9b13',
            countTrades: 2,
            priceDelta: 0.009999999999990905,
            priceDeltaPerc: 0.00003214607175000291
          },
        */

        return data.reduce((acc, val) => {
            const {
                direction,
                priceDeltaPerc,
                quantity,
                priceDeltaPerc,
            } = val;

            let name = 'sell';

            if (direction === OrderDirection.ORDER_DIRECTION_BUY) {
                name = 'buy';
            }

            if (priceDeltaPerc > 0) {
                acc[name].deltaUpCnt += 1;
                acc[name].q += quantity;
                acc[name].sumPerc += priceDeltaPerc;
            } else if (priceDeltaPerc < 0) {
                acc[name].deltaDownCnt += 1;
                acc[name].q += quantity;
                acc[name].sumPerc += priceDeltaPerc;
            } else {
                acc[name].nonChange.q += quantity;
                acc[name].nonChange.cnt += 1;
            }

            return acc;
        }, {
            buy: {
                q: 0,
                deltaUpCnt: 0,
                deltaDownCnt: 0,
                sumPerc: 0,

                nonChange: {
                    q: 0,
                    cnt: 0,
                },
            },
            sell: {
                q: 0,
                deltaUpCnt: 0,
                deltaDownCnt: 0,
                sumPerc: 0,

                nonChange: {
                    q: 0,
                    cnt: 0,
                },
            },
        });
    }

    getAllTradesAggregated(uid) {
        return this.allLastTradesAggregated?.[uid];
    }

    // accountId
    async subscribes() { // eslint-disable-line sonarjs/cognitive-complexity
        try {
            const { subscribes } = this.cb || {};

            const shares = await this.getSharesForTrading({
                maxLotPrice: 3500,
            });

            if (this.inProgress) {
                return;
            }

            this.inProgress = true;

            // const instruments = (shares);
            this.allLastTrades = {};
            this.allLastTradesAggregated = {};

            // console.log('Object.keys(instruments)', Object.keys(instruments).length);

            setImmediate(async () => {
                // console.log('subscr');
                let gen = this.sdk?.marketDataStream.marketDataStream((async function* () {
                    try {
                        while (this.inProgress) {
                            await this.timer(this.subscribesTimer);
                            yield MarketDataRequest.fromPartial({
                                subscribeTradesRequest: {
                                    subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
                                    tradeType: TradeSourceType.TRADE_SOURCE_ALL,
                                    instruments: Object.keys(shares)
                                        .map(f => { return { instrumentId: f } }),
                                },
                            });
                        }

                        gen = null;
                    } catch (e) {
                        console.log(e); // eslint-disable-line no-console
                    }
                }).call(this), this.getSubscribeOptions());

                try {
                    for await (const data of gen) {
                        try {
                            const name = 'trade';

                            // console.log(data);

                            if (data[name]) {
                                const { instrumentUid } = data[name];

                                if (!this.allLastTrades[instrumentUid]) {
                                    this.allLastTrades[instrumentUid] = [];
                                }

                                // if (!this.allLastTradesAggregated) {
                                // }

                                this.allLastTrades[instrumentUid].push(
                                    data[name],
                                );

                                if (this.allLastTrades[instrumentUid].length > 500) {
                                    this.allLastTrades[instrumentUid] = this.allLastTrades[instrumentUid]
                                        .slice(-500)
                                        .sort((a, b) => b.time.getTime() - a.time.getTime());
                                }

                                // if (instrumentUid === '2dfbc1fd-b92a-436e-b011-928c79e805f2') {
                                //     console.log('HERE', instrumentUid);
                                // }

                                this.allLastTradesAggregated[instrumentUid] = [];
                                const cur = this.allLastTradesAggregated[instrumentUid];

                                this.allLastTrades[instrumentUid].forEach(t => {
                                    if (!cur.length) {
                                        cur.push({
                                            ...t,
                                            countTrades: 1,
                                            priceDelta: 0,
                                        });
                                    } else {
                                        const last = cur[cur.length - 1];
                                        const priceDelta = (Common.getPrice(t.price) || 0) - (Common.getPrice(last.price) || 0);

                                        if (t.direction !== last.direction ||
                                            t.price.units !== last.price.units &&
                                            t.price.nano !== last.price.nano
                                        ) {
                                            cur.push({
                                                ...t,
                                                countTrades: 1,
                                                priceDelta,
                                                priceDeltaPerc: priceDelta / (Common.getPrice(t.price) || 1),
                                            });
                                        } else {
                                            last.quantity += t.quantity;
                                            last.countTrades += 1;
                                        }
                                    }
                                });

                                // console.log(this.allLastTradesAggregated[instrumentUid]);

                                // this.subscribeDataUpdated[name] = true;
                                // const isLastPrice = name === 'lastPrice';
                                // const currentData = isLastPrice ? data[name].price : data[name];

                                // this[data[name].instrumentId] || (this[data[name].instrumentId] = {});
                                // this[data[name].instrumentId][name] = currentData;

                                // if (!this.isPortfolio) {
                                //     this[name] = currentData;
                                // }
                            }
                        } catch (e) {
                            console.log(e); // eslint-disable-line no-console
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
                    // await this.restart(this.robotTimer + this.subscribesTimer);
                    await this.timer(500);
                    await this.subscribes();
                }
            });

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

            // 0 && ['orders', 'positions'].forEach(name => {
            //     if (subscribes[name]) {
            //         setImmediate(async () => {
            //             try {
            //                 let gen = subscribes[name]({
            //                     accounts: [accountId],
            //                 }, this.getSubscribeOptions());

            //                 for await (const data of gen) {
            //                     if (data.orderTrades) {
            //                         if (!this.orderTrades) {
            //                             this.orderTrades = [];
            //                         }

            //                         this.orderTrades.push(data.orderTrades);
            //                         await this.updateOrders();
            //                     } else if (data.position && this.isPortfolio) {
            //                         [
            //                             'securities',

            //                             // 'futures',
            //                             // 'options',
            //                         ].forEach(name => {
            //                             try {
            //                                 if (!data.position[name] || !data.position[name].length) {
            //                                     return;
            //                                 }

            //                                 data.position[name].forEach(async (p: { instrumentId: any; instrumentType: any; }) => {
            //                                     const currentIndex = this.currentPositions.findIndex(c => {
            //                                         return c.instrumentId === p.instrumentId &&
            //                                             c.instrumentType === p.instrumentType;
            //                                     });

            //                                     if (currentIndex >= 0) {
            //                                         this.currentPositions[currentIndex] = {
            //                                             ...this.currentPositions[currentIndex],
            //                                             ...p,
            //                                         };
            //                                     } else {
            //                                         await this.updatePositions();
            //                                     }
            //                                 });
            //                             } catch (e) {
            //                                 console.log(e); // eslint-disable-line no-console
            //                             }
            //                         });

            //                         await this.updateInstrumentId();

            //                         // await this.updateOrdersInLog();
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
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getAllInstruments(name?: string) {
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

            const names = name ? [name] : [
                'shares',

                // 'bonds', 'futures',
                // 'etfs', 'options', 'currencies',
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
        this.allRequestsCacheData = {};

        setInterval(() => {
            this.requests.count = 0;
        }, 1000);

        setInterval(() => {
            this.allRequestsCacheData = {};
        }, 2000);

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

    async getLastTrades(uid, from?: Date, to?: Date) {
        try {
            const reqName = 'marketData';
            const cacheName = reqName + uid;

            return this.getCacheOrRequest(reqName, cacheName, async () => {
                return !from && !to ?
                    await this.sdk.marketData.getLastTrades({ instrumentId: uid }) :
                    await this.sdk.marketData.getLastTrades({
                        instrumentId: uid,
                        from,
                        to,
                    });
            });
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getLastPrices(uids: string[]) {
        try {
            const reqName = 'marketData';
            const cacheName = reqName + uids.join(':');

            return this.getCacheOrRequest(reqName, cacheName, async () => await this.sdk.marketData.getLastPrices({ instrumentId: uids }));
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getOrderBook(uid) {
        try {
            const reqName = 'marketData';
            const cacheName = reqName + uid;

            return this.getCacheOrRequest(reqName, cacheName, async () => await this.sdk.marketData.getOrderBook({
                depth: 50,
                instrumentId: uid,
            }));
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getMarketTechAnalysis(req) {
        try {
            const reqName = 'marketData';
            const cacheName = reqName + JSON.stringify(req);

            return this.getCacheOrRequest(reqName, cacheName, async () => await this.sdk.marketData.getTechAnalysis(req));
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    createCacheWayIfNotExist(requestName: string, cacheName: string) {
        if (!this.allRequestsCacheData) {
            this.allRequestsCacheData = {};
        }

        if (!this.allRequestsCacheData[requestName]) {
            this.allRequestsCacheData[requestName] = {};
        }

        if (!this.allRequestsCacheData[requestName][cacheName]) {
            this.allRequestsCacheData[requestName][cacheName] = {};
        }
    }

    async getCacheOrRequest(requestName: string, cacheName: string, cb: () => Promise<any>, timeout = 1000) {
        try {
            if (!this.checkLimits(requestName)) {
                this.createCacheWayIfNotExist(requestName, cacheName);
                const curData = this.allRequestsCacheData[requestName][cacheName];

                if (curData.timeout && (curData.timeout + timeout) > Date.now() && curData.data) {
                    return curData.data;
                }

                await this.timer(60000);
            }

            const data = await cb();

            this.createCacheWayIfNotExist(requestName, cacheName);

            this.allRequestsCacheData[requestName][cacheName] = {
                timeout: Date.now(),
                data,
            };

            return data;
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getAllShares() {
        try {
            if (!this.allInstrumentsInfo || !Object.keys(this.allInstrumentsInfo).length) {
                await this.timer(100);
                await this.getAllInstruments();

                return await this.getAllShares();
            }

            this.allSharesInfo = this.allSharesInfo || Object.keys(this.allInstrumentsInfo)
                .filter(key => Boolean(this.allInstrumentsInfo[key].shareType))
                .map(key => this.allInstrumentsInfo[key]);

            return this.allSharesInfo;
        } catch (e) {
            console.log(e); // eslint-disable-line no-console

            return [];
        }
    }

    /**
     * Возвращает массив акций, доступных для торговли и подходящих для заданного лимита лота.
     */
    async getSharesForTrading(props?: { maxLotPrice?: number }) {
        try {
            const { maxLotPrice } = props || {};

            // Получение акций, доступных для торговли, в виде объекта. Где ключ — это uid, для быстрого доступа в дальнейшем.
            const shares = (await this.getAllShares())?.filter(f => f.currency === 'rub' &&
                f.apiTradeAvailableFlag &&
                f.buyAvailableFlag &&

                // f.tradingStatus &&
                // Убираем всё что для квалов.
                !f.forQualInvestorFlag &&
                f.sellAvailableFlag,
            )?.reduce<{ [key: string]: Share }>((acc, val) => {
                acc[val.uid] = val;

                return acc;
            }, {});

            if (!shares) {
                return;
            }

            const prices = await this.getLastPrices(Object.keys(shares));

            const lotPriceArr: {
                [key: string]: number | string;
            }[] = [];

            // Фильтрует цены, с учётом лотности, которые нужно удалить.
            const filtredPricesToDel = !maxLotPrice ? [] : prices?.lastPrices?.filter(f => {
                if (!shares?.[f.instrumentUid]?.lot) {
                    return false;
                }

                const currentPrice = Common.getPrice(f.price) || 0;
                const lotPrice = currentPrice * shares[f.instrumentUid].lot;

                return lotPrice > maxLotPrice;
            });

            // Возвращает массив инструментов, которые отфильтрованы по заданным выше условиям.
            filtredPricesToDel?.forEach(f => {
                delete shares[f.instrumentUid];
            });

            return shares;
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }
}
