/* eslint @typescript-eslint/no-explicit-any: 0 */
/* eslint @typescript-eslint/ban-types: 0 */
/* eslint sonarjs/no-duplicate-string: 0 */
/* eslint camelcase: 0 */

import { createSdk } from 'tinkoff-sdk-grpc-js';
import {
    MoneyValue,
    PriceType,
    Quotation,
} from 'tinkoff-sdk-grpc-js/dist/generated/common';

import {
    OrderDirection,
    OrderExecutionReportStatus,
    OrderType,
    TimeInForceType,
} from 'tinkoff-sdk-grpc-js/dist/generated/orders';
import {
    GetOrderBookRequest,
    GetTechAnalysisRequest_IndicatorInterval,
    GetTechAnalysisRequest_IndicatorType,
    GetTechAnalysisRequest_TypeOfPrice,
    MarketDataRequest,
    SubscriptionAction,
    TradeSourceType,
} from 'tinkoff-sdk-grpc-js/dist/generated/marketdata';
import { Common } from '../Common/TsCommon';
import {
    Share,
} from 'tinkoff-sdk-grpc-js/dist/generated/instruments';

import EventEmitter from 'events';

interface IShares {
    [key: string]: Share
}

class TRequests {
    sdk: ReturnType<typeof createSdk>;
    isSandbox?: boolean;

    allInstrumentsInfo: IShares;

    eventEmitter: EventEmitter<[never]>;

    static rpsRequests = {
        count: 0,
        limit: 50,
    };

    static requests: {

        // count: number;
        // limit: number;
        [x: string]: {
            count: number;
            limit: number;
        }
    } = {
            // lastMinutes: new Date().getMinutes(),
            // lastSeconds: new Date().getSeconds(),
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

    static reqKeys = Object.keys(TRequests.requests).filter(k => typeof TRequests.requests[k] === 'object');
    subscribesTimer: number;
    subscribeDataUpdated: {};
    allLastPrices: {
        [x: string]: {
            price: Quotation | undefined;
            time: number;
        };
    };
    inited: boolean;
    subscrNoAccinProgress: boolean | undefined;
    allLastTrades: any;
    allLastTradesAggregated: any;
    subscrAccList: any;
    sybscrWithAccinProgress!: boolean;
    genSubscrWithAccId: any;
    cb!: {};
    allInstrumentsInfoTimeout!: number;
    static allInstrumentsInfo: { [key: string]: Share; };
    currentOrders: any;
    ordersInited!: boolean;
    static allRequestsCacheData: {
        [key: string]: {
            [key: string]: {
                timeout?: number;
                data?: unknown;
            }
        };
    };
    allSharesInfo!: Share[];

    constructor(
        sdk: ReturnType<typeof createSdk>,
        options?: {
            isSandbox: boolean | undefined;
        },
    ) {
        this.sdk = sdk;
        this.isSandbox = options?.isSandbox;

        this.allInstrumentsInfo = {};
        this.eventEmitter = new EventEmitter();

        // Таймер подписки на события.
        this.subscribesTimer = 150;
        this.subscribeDataUpdated = {};

        this.allLastPrices = {};

        // this.instrumentsStack = Array(this.limits.instruments);
        // this.accountsStack = Array(this.limits.accounts);
        // this.operationsStack = Array(this.limits.operations);
        // this.ordersStack = Array(this.limits.orders);
        // this.marketDataStack = Array(this.limits.marketData);
        // this.stopOrdersStack = Array(this.limits.stopOrders);
        this.inited = false;

        this.asyncInit();
        setInterval(() => this.asyncInit(), 24 * 3600 * 1000);

        // this.clean();
    }

    getEventEmitter() {
        return this.eventEmitter;
    }

    // @ts-ignore
    eventEmit(name: string | symbol, data: any) {
        this.eventEmitter.emit(name, data);
    }

    static timer(time: number | undefined) {
        return new Promise(resolve => setTimeout(resolve, time));
    }

    timer(time: number | undefined) {
        return TRequests.timer(time);
    }

    async asyncInit() {
        await this.getAllInstruments();
        this.inited = true;
    }

    // getSubscribeOptions() {
    //     const abortSubscribe = (_type: any, abort: () => void) => {
    //         // console.log('abort', this.subscrNoAccinProgress);
    //         if (!this.subscrNoAccinProgress) {
    //             abort();
    //         }
    //     };

    //     return {
    //         signal: {
    //             addEventListener: abortSubscribe,
    //             removeEventListener: abortSubscribe,
    //         },
    //     };
    // }

    // getSubscribeOptionsWithAccs() {
    //     const controller = new AbortController();
    //     const signal = controller.signal;

    //     const abortSubscribe = () => {
    //         if (!this.subscribesWithAccount) {
    //             controller.abort(); // Прерываем подписку
    //             signal.removeEventListener('abort', abortSubscribe); // Удаляем обработчик
    //         }
    //     };

    //     signal.addEventListener('abort', abortSubscribe);

    //     return {
    //         signal,
    //     };
    // }

    // getSubscribeOptionsWithAccs() {
    //     const abortSubscribe = (_type: any, abort: () => void) => {
    //         // console.log('abort', this.subscrNoAccinProgress);
    //         if (!this.subscribesWithAccount) {
    //             abort();
    //         }
    //     };

    //     // const abortSubscribeRemove = (_type: any, abort: () => void) => {
    //     //     // console.log('abort', this.subscrNoAccinProgress);
    //     //     // if (!this.subscribesWithAccount) {
    //     //     console.log('abortSubscribeRemove', abortSubscribeRemove);
    //     //     abort();
    //     //     // }
    //     // };

    //     return {
    //         signal: {
    //             addEventListener: abortSubscribe,
    //             removeEventListener: abortSubscribe,
    //         },
    //     };
    // }

    getAllTrades(uid: string) {
        return this.allLastTrades?.[uid];
    }

    getAllTradesAggregatedStat(uid: string) {
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

        return data.reduce((acc: {
            [x: string]: {
                deltaUpCnt: number;
                q: any;
                sumPerc: any;
                deltaDownCnt: number; nonChange: {
                    q: any; cnt: number;
                };
            };
        }, val: { direction: any; priceDeltaPerc: any; quantity: any; }) => {
            const {
                direction,
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

    getAllTradesAggregated(uid: string | number) {
        return this.allLastTradesAggregated?.[uid];
    }

    async subscribesWithAccount(accountId?: string) {
        if (!accountId && !this.subscrAccList) {
            return;
        }

        if (accountId) {
            if (!this.subscrAccList) {
                this.subscrAccList = new Set([accountId]);
            } else {
                this.subscrAccList.add(accountId);
            }
        }

        this.sybscrWithAccinProgress = true;

        try {
            if (!this.genSubscrWithAccId) {
                this.genSubscrWithAccId = 1;
            } else {
                ++this.genSubscrWithAccId;
            }

            setImmediate(async () => {
                try {
                    const id = this.genSubscrWithAccId;

                    // let gen = subscribes[name]({
                    //     accounts: [accountId],
                    // }, this.getSubscribeOptions());
                    let gen;

                    gen = this.sdk?.ordersStream.tradesStream({
                        accounts: Array.from(this.subscrAccList),
                    }); // , this.getSubscribeOptionsWithAccs());

                    for await (const data of gen) {
                        if (id !== this.genSubscrWithAccId) {
                            gen = undefined;
                            break;
                        }

                        if (data.orderTrades) {
                            const {
                                accountId,
                            } = data?.orderTrades || {};

                            if (accountId) {
                                this.eventEmitter.emit('subscribe:orderTrades:' +
                                    accountId, data.orderTrades);
                            }
                        }

                        if (!this.sybscrWithAccinProgress) {
                            gen = undefined;
                            break;
                        }
                    }
                } catch (e) {
                    console.log(e); // eslint-disable-line no-console

                    // Перезапускаем робота в случае ошибки.
                    // Ошибка сюда прилетит в случае обрыва соединения.
                    // await this.restart(this.robotTimer + this.subscribesTimer);
                    this.sybscrWithAccinProgress = false;
                    await this.timer(500);
                    await this.subscribesWithAccount();
                }
            });
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    getLastPrice(instrumentUid: string | number) {
        return this.allLastPrices?.[instrumentUid];
    }

    updateLastPrice(instrumentUid: string,
        price: Quotation | undefined,
        time: Date, checkTime = false,
    ) {
        const t = new Date(time).getTime();

        if (!checkTime || !this.allLastPrices[instrumentUid] ||
            new Date(
                this.allLastPrices[instrumentUid].time,
            ).getTime() < t
        ) {
            this.allLastPrices[instrumentUid] = {
                price,
                time: t,
            };
        }
    }

    async subscribes() { // eslint-disable-line sonarjs/cognitive-complexity
        try {
            // const { subscribes } = this.cb || {};

            const shares = await this.getSharesForTrading({
                // maxLotPrice: 3500,
            });

            if (this.subscrNoAccinProgress || !shares) {
                return;
            }

            this.subscrNoAccinProgress = true;

            // const instruments = (shares);
            this.allLastTrades = {};
            this.allLastTradesAggregated = {};

            // console.log('Object.keys(instruments)', Object.keys(instruments).length);

            setImmediate(async () => {
                let gen;

                const _this = this; // eslint-disable-line @typescript-eslint/no-this-alias

                gen = this.sdk?.marketDataStream.marketDataStream((async function* () {
                    try {
                        while (_this.subscrNoAccinProgress) {
                            await _this.timer(_this.subscribesTimer);
                            yield MarketDataRequest.fromPartial({
                                subscribeLastPriceRequest: {
                                    subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
                                    instruments: Object.keys(shares)
                                        .map(f => { return { instrumentId: f } }),
                                },
                                subscribeTradesRequest: {
                                    subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
                                    tradeSource: TradeSourceType.TRADE_SOURCE_ALL,
                                    instruments: Object.keys(shares)
                                        .map(f => { return { instrumentId: f } }),
                                },
                            });
                        }

                        gen = null;
                    } catch (e) {
                        console.log(e); // eslint-disable-line no-console
                    }
                })()); // , this.getSubscribeOptions());

                try {
                    for await (const data of gen) {
                        try {
                            if (data['lastPrice'] && data.lastPrice?.time) {
                                const { instrumentUid, price, time } = data.lastPrice;

                                this.updateLastPrice(instrumentUid, price, time);
                            } else if (data['trade']) {
                                const name = 'trade';
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
                                        .sort(
                                            (a: {
                                                time: { getTime: () => number; };
                                            },
                                            b: {
                                                    time: { getTime: () => number; };
                                                }) => b.time.getTime() -
                                                a.time.getTime());
                                }

                                // if (instrumentUid === '2dfbc1fd-b92a-436e-b011-928c79e805f2') {
                                //     console.log('HERE', instrumentUid);
                                // }

                                this.allLastTradesAggregated[instrumentUid] = [];
                                const cur = this.allLastTradesAggregated[instrumentUid];

                                this.allLastTrades[instrumentUid]
                                    .forEach((t: {
                                        price: Quotation | undefined;
                                        direction: any; quantity: any;
                                    }) => {
                                        if (!cur.length) {
                                            cur.push({
                                                ...t,
                                                countTrades: 1,
                                                priceDelta: 0,
                                            });
                                        } else {
                                            const last = cur[cur.length - 1];
                                            const priceDelta = (
                                                Common.getPrice(t.price) || 0
                                            ) - (Common.getPrice(last.price) || 0);

                                            if (t.direction !== last.direction ||
                                                t?.price?.units !== last?.price?.units &&
                                                t?.price?.nano !== last?.price?.nano
                                            ) {
                                                cur.push({
                                                    ...t,
                                                    countTrades: 1,
                                                    priceDelta,
                                                    priceDeltaPerc: priceDelta / (
                                                        Common.getPrice(t.price) || 1
                                                    ),
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

                            //  else {
                            //     console.log(data);
                            // }
                        } catch (e) {
                            console.log(e); // eslint-disable-line no-console
                        }

                        if (!this.subscrNoAccinProgress) {
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
            //                     while (this.subscrNoAccinProgress) {
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
            //                     if (!this.subscrNoAccinProgress) {
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

            // ['orders', 'positions'
            // ].forEach(name => {
            // if (subscribes[name]) {

            // }
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
            } else if (!TRequests.checkLimits('instruments')) {
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

                    if (!TRequests.checkLimits('instruments')) {
                        continue;
                    }

                    if (name !== 'shares') {
                        continue;
                    }

                    const { instruments } = await this.sdk.instruments[name](req);

                    if (instruments?.length) {
                        instruments.forEach((instrument: Share) => {
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

        TRequests.allInstrumentsInfo = this.allInstrumentsInfo;

        return this.allInstrumentsInfo;
    }

    async getOpenOrders(accountId: string) {
        try {
            const reqName = 'orders';
            const cacheName = reqName + accountId;

            return await TRequests.getCacheOrRequest(reqName, cacheName, async () => {
                const { orders } = await this.sdk?.orders.getOrders({ accountId }) || {};

                return orders && orders.filter((o: { executionReportStatus: number; }) => [
                    OrderExecutionReportStatus.EXECUTION_REPORT_STATUS_NEW,
                    OrderExecutionReportStatus.EXECUTION_REPORT_STATUS_PARTIALLYFILL,
                ].includes(o.executionReportStatus));
            });
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getPortfolio(accountId: string) {
        try {
            if (!accountId) {
                throw 'Укажите accountId';
            }

            const reqName = 'operations';
            const cacheName = reqName + accountId;

            return await TRequests.getCacheOrRequest(reqName, cacheName, async () => {
                return await this.sdk?.operations.getPortfolio({ accountId });
            });
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async cancelOrder(accountId: string, orderId: string) {
        try {
            const reqName = 'orders';
            const cacheName = reqName + accountId + orderId;

            return await TRequests.getCacheOrRequest(reqName, cacheName, async () => {
                return (await this.sdk.orders.cancelOrder({
                    accountId,
                    orderId,
                }));
            });
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async postOrder(
        orderData: {
            accountId: any;
            instrumentId: string | undefined;
            quantity: any;
            price: any;
            direction: OrderDirection | undefined;
            orderType: OrderType | undefined;
            orderId: any;
            figi?: string | undefined;
            timeInForce?: TimeInForceType | undefined;
            priceType?: PriceType | undefined;
        },
    ) {
        try {
            const reqName = 'orders';
            const cacheName = reqName + JSON.stringify(orderData);

            return await TRequests.getCacheOrRequest(reqName, cacheName, async () => {
                return (await this.sdk.orders.postOrder(orderData));
            });
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async replaceOrder(
        orderData: {
            accountId: any;
            orderId: string | undefined;
            quantity: number | undefined;
            price: MoneyValue | {
                units?: number | undefined; nano?: number | undefined;
            } | undefined;
            idempotencyKey: string | undefined;
            priceType?: PriceType | undefined;
        },
    ) {
        try {
            const reqName = 'orders';
            const cacheName = reqName + JSON.stringify(orderData);

            return await TRequests.getCacheOrRequest(reqName, cacheName, async () => {
                return (await this.sdk.orders.replaceOrder(orderData));
            });
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async updateOrders(accountId: string) {
        this.currentOrders = await this.getOpenOrders(accountId);
        this.ordersInited = true;
    }

    static clean() {
        try {
            TRequests.allRequestsCacheData = {};

            setInterval(() => {
                TRequests.rpsRequests.count = 0;
            }, 1000);

            setInterval(() => {
                TRequests.allRequestsCacheData = {};
            }, 2000);

            setInterval(() => {
                try {
                    // TRequests.requests.lastMinutes = new Date().getMinutes();
                    for (let i = 0; i < TRequests.reqKeys.length; i++) {
                        if (TRequests.requests[TRequests.reqKeys[i]].count) {
                            TRequests.requests[TRequests.reqKeys[i]].count = 0;
                        }
                    }
                } catch (e) {
                    console.log(e); // eslint-disable-line no-console
                }
            }, 60000);
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    static checkLimits(type: string) {
        try {
            if (TRequests.rpsRequests.count >= TRequests.rpsRequests.limit) {
                throw `RPS limit ${type} ${TRequests.rpsRequests.count} / ${TRequests.rpsRequests.limit}`;
            }

            if (TRequests.requests[type].count >= TRequests.requests[type].limit) {
                throw `${type} limit ${TRequests.requests[type].count} / ${TRequests.requests[type].limit}`;
            }

            ++TRequests.rpsRequests.count;
            ++TRequests.requests[type].count;

            return true;
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }

        return false;
    }

    async getPositions(accountId: string) {
        try {
            if (!accountId) {
                throw 'Укажите accountId';
            }

            const reqName = 'operations';
            const cacheName = reqName + accountId;

            return await TRequests.getCacheOrRequest(reqName, cacheName, async () => {
                return await this.sdk?.operations.getPositions({ accountId });
            });
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getLastTrades(uid: string, from?: Date, to?: Date, timeout = 120000) {
        try {
            const reqName = 'marketData';
            const cacheName = reqName + uid;

            return await TRequests.getCacheOrRequest(reqName, cacheName, async () => {
                return !from && !to ?
                    await this.sdk.marketData.getLastTrades({ instrumentId: uid }) :
                    await this.sdk.marketData.getLastTrades({
                        instrumentId: uid,
                        from,
                        to,
                    });
            }, timeout);
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    static async getLastPrices(sdk: ReturnType<typeof createSdk>, uids: string[]) {
        try {
            const reqName = 'marketData';
            const cacheName = reqName + uids.join(':');

            return await TRequests.getCacheOrRequest(
                reqName, cacheName, async () => await sdk?.marketData.getLastPrices({ instrumentId: uids }));
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getLastPrices(uids: string[]) {
        return await TRequests.getLastPrices(this.sdk, uids);
    }

    async getOrderBook(req: GetOrderBookRequest) {
        try {
            const reqName = 'marketData';
            const cacheName = reqName + JSON.stringify(req);

            return await TRequests.getCacheOrRequest(reqName, cacheName, async () => {
                return await this.sdk.marketData.getOrderBook(req);
            });
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getTradingStatuses(ids: string[]) {
        try {
            const reqName = 'marketData';
            const cacheName = reqName + ids.join(':');

            return await TRequests.getCacheOrRequest(reqName, cacheName, async () => {
                return (await this.sdk.marketData.getTradingStatuses({
                    instrumentId: ids,
                }));
            });
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getFavorites() {
        try {
            const reqName = 'instruments';
            const cacheName = reqName;

            return await TRequests.getCacheOrRequest(reqName, cacheName, async () => {
                // if (this.isSandbox) {
                //     return;
                // }

                return (await this.sdk?.instruments.getFavorites({}));
            });
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getOrderPrice(
        props: {
            accountId?: string | undefined;
            instrumentId?: string | undefined;
            price?: {
                units?: number | undefined; nano?: number | undefined;
            } | undefined;
            direction?: OrderDirection | undefined;
            quantity?: number | undefined;
        },
    ) {
        try {
            const reqName = 'orders';
            const cacheName = reqName + JSON.stringify(props);

            return await TRequests.getCacheOrRequest(reqName, cacheName, async () => {
                if (this.isSandbox) {
                    return;
                }

                return (await this.sdk.orders.getOrderPrice(props));
            });
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getMaxLots(accountId: string, instrumentUid: string, price: MoneyValue | Quotation | undefined) {
        try {
            const reqName = 'orders';
            const cacheName = reqName + accountId + instrumentUid + Common.getPrice(price);

            return await TRequests.getCacheOrRequest(reqName, cacheName, async () => {
                return (await this.sdk.orders.getMaxLots({
                    accountId,
                    instrumentId: instrumentUid,
                    price,
                }));
            });
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getMarketTechAnalysis(req: {
        indicatorType: GetTechAnalysisRequest_IndicatorType | undefined;
        instrumentUid: string | undefined;
        from: Date | undefined;
        to: Date | undefined;
        interval: GetTechAnalysisRequest_IndicatorInterval | undefined;
        typeOfPrice: GetTechAnalysisRequest_TypeOfPrice | undefined;
        length: number | undefined;
        deviation?: {
            deviationMultiplier?: {
                units?: number | undefined; nano?: number | undefined;
            } | undefined;
        } | undefined;
        smoothing?: {
            fastLength?: number | undefined; slowLength?: number | undefined;
            signalSmoothing?: number | undefined;
        } | undefined;
    }) {
        try {
            const reqName = 'marketData';
            const cacheName = reqName + JSON.stringify(req);

            return await TRequests.getCacheOrRequest(
                reqName, cacheName,
                async () => await this.sdk.marketData.getTechAnalysis(req),
            );
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    static createCacheWayIfNotExist(requestName: string, cacheName: string) {
        if (!TRequests.allRequestsCacheData) {
            TRequests.allRequestsCacheData = {};
        }

        if (!TRequests?.allRequestsCacheData?.[requestName]) {
            TRequests.allRequestsCacheData[requestName] = {};
        }

        if (!TRequests.allRequestsCacheData[requestName][cacheName]) {
            TRequests.allRequestsCacheData[requestName][cacheName] = {};
        }
    }

    // @ts-ignore
    static async getCacheOrRequest(requestName: string, cacheName: string, cb: () => Promise<any>, timeout = 1000) {
        try {
            if (!TRequests.checkLimits(requestName)) {
                TRequests.createCacheWayIfNotExist(requestName, cacheName);
                const curData = TRequests.allRequestsCacheData[requestName][cacheName];

                if (curData.timeout && (curData.timeout + timeout) > Date.now() && curData.data) {
                    return curData.data;
                }

                await TRequests.timer(60000);

                return await TRequests.getCacheOrRequest(requestName, cacheName, cb);
            }

            const data = await cb();

            TRequests.createCacheWayIfNotExist(requestName, cacheName);

            TRequests.allRequestsCacheData[requestName][cacheName] = {
                timeout: Date.now(),
                data,
            };

            return data;
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getAllShares(): Promise<Share[]> {
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
        }

        return [];
    }

    /**
     * Возвращает массив акций, доступных для торговли и подходящих для заданного лимита лота.
     */
    async getSharesForTrading(props?: { maxLotPrice?: number }) {
        try {
            const { maxLotPrice } = props || {};

            const allShares = await this.getAllShares();

            const filtredShares = allShares?.filter(f => f.currency === 'rub' &&
                f.apiTradeAvailableFlag &&
                f.buyAvailableFlag &&

                // f.tradingStatus &&
                // Убираем всё что для квалов.
                !f.forQualInvestorFlag &&
                f.sellAvailableFlag,
            );

            // Получение акций, доступных для торговли, в виде объекта. Где ключ — это uid, для быстрого доступа в дальнейшем.
            const shares = filtredShares?.reduce<{ [key: string]: Share }>(
                (
                    acc: {
                        [x: string]: any;
                    },
                    val: {
                        uid: string | number;
                    },
                ) => {
                    acc[val.uid] = val;

                    return acc;
                }, {});

            if (!shares) {
                return;
            }

            const prices = await this.getLastPrices(Object.keys(shares));

            // const lotPriceArr: {
            //     [key: string]: number | string;
            // }[] = [];

            if (maxLotPrice) {
                // Фильтрует цены, с учётом лотности, которые нужно удалить.
                const filtredPricesToDel = prices?.lastPrices?.filter(
                    (
                        f: {
                            instrumentUid: string | number;
                            price: MoneyValue | Quotation | undefined;
                        },
                    ) => {
                        if (!shares?.[f.instrumentUid]?.lot) {
                            return false;
                        }

                        const currentPrice = Common.getPrice(f.price) || 0;
                        const lotPrice = currentPrice * shares[f.instrumentUid].lot;

                        return lotPrice > maxLotPrice;
                    });

                // Возвращает массив инструментов, которые отфильтрованы по заданным выше условиям.
                filtredPricesToDel?.forEach((f: { instrumentUid: string | number; }) => {
                    delete shares[f.instrumentUid];
                });
            }

            return shares;
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }

        return undefined;
    }
}

TRequests.clean();

export { TRequests };
