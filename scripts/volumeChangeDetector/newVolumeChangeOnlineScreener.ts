/* eslint-disable */
// черновик
// import { Candles } from '../../components/investAPI/candles';
import { createSdk } from 'tinkoff-sdk-grpc-js';
import { ACCOUNTID, TOKEN } from '../../config';

import { Instruments } from '../../components/investAPI/instruments';
import { logger } from '../../src/utils';
import { DeepPartial, MarketDataRequest, OrderBookType, SubscriptionAction, TradeDirection } from 'tinkoff-sdk-grpc-js/dist/generated/marketdata';
import { Common } from '../../src/Common/TsCommon';

// import { Common } from '../../src/Common/TsCommon';
// import fs from 'fs';
// import path from 'path';
import { OrderDirection, OrderType } from 'tinkoff-sdk-grpc-js/dist/generated/orders';
import { v4 as uuidv4 } from 'uuid';

// const tradeUids = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'tickers.json')).toString())
//     .map((u: { uid: string; }) => u.uid);

const dashboardTickes = [
    { ticker: 'SBER', uid: 'e6123145-9665-43e0-8413-cd61b8aa9b13', lot: 10 },
    { ticker: 'GAZP', uid: '962e2a95-02a9-4171-abd7-aa198dbe643a', lot: 10 },
    { ticker: 'TRNFP', uid: '653d47e9-dbd4-407a-a1c3-47f897df4694', lot: 1 },
    { ticker: 'OZON', uid: '35fb8d6b-ed5f-45ca-b383-c4e3752c9a8a', lot: 1 },
    { ticker: 'TCSG', uid: 'eed9621b-6412-4f4b-a166-758882cc7a4c', lot: 1 },
    { ticker: 'AFKS', uid: '53b67587-96eb-4b41-8e0c-d2e3c0bdd234', lot: 100 },
    { ticker: 'SGZH', uid: '7bedd86b-478d-4742-a28c-29d27f8dbc7d', lot: 100 },
    { ticker: 'UNAC', uid: '43666aea-a4df-46e1-a815-e5eccbc1fb3f', lot: 1000 },
    { ticker: 'IRAO', uid: '2dfbc1fd-b92a-436e-b011-928c79e805f2', lot: 100 },
    { ticker: 'TATN', uid: '88468f6c-c67a-4fb4-a006-53eed803883c', lot: 1 },
    { ticker: 'VTBR', uid: '8e2b0325-0292-4654-8a18-4f63ed3b0e09', lot: 10000 },
    { ticker: 'CHMF', uid: 'fa6aae10-b8d5-48c8-bbfd-d320d925d096', lot: 1 },
    { ticker: 'ROSN', uid: 'fd417230-19cf-4e7b-9623-f7c9ca18ec6b', lot: 1 },
    { ticker: 'NVTK', uid: '0da66728-6c30-44c4-9264-df8fac2467ee', lot: 1 },
    { ticker: 'SNGS', uid: '1ffe1bff-d7b7-4b04-b482-34dc9cc0a4ba', lot: 100 },
    { ticker: 'POSI', uid: 'de08affe-4fbd-454e-9fd1-46a81b23f870', lot: 1 },
    { ticker: 'SIBN', uid: '9ba367af-dfbd-4d9c-8730-4b1d5a47756e', lot: 1 },
    { ticker: 'RNFT', uid: 'c7485564-ed92-45fd-a724-1214aa202904', lot: 1 },
    { ticker: 'RUAL', uid: 'f866872b-8f68-4b6e-930f-749fe9aa79c0', lot: 10 },
    { ticker: 'LKOH', uid: '02cfdf61-6298-4c0f-a9ca-9cabc82afaf3', lot: 1 },
    { ticker: 'IMOEXF', uid: '5bcff194-f10d-4314-b9ee-56b7fdb344fd', lot: 1 },
];

// const tickerDataByUid = dashboardTickes.reduce((acc, val) => {
//     acc[val.uid] = val;
//     return acc;
// }, {});

const sdk = createSdk(TOKEN, 'backtester', logger);

// const candlesSdk = new Candles(sdk);
const instruments = new Instruments(sdk);
const timer = (time: number) => new Promise(resolve => setTimeout(resolve, time));

const startData = {
    buyPrices: {},
    sellPrices: {},
    buyQuantityCount: 0,
    sellQuantityCount: 0,
};

(async () => { // eslint-disable-line
    const allBaseShares = (await instruments.getAllShares()).filter(f => f.currency === 'rub');

    // const to = new Date();
    // const from = new Date(Date.now() - 3600000);

    const cachedUidTicker: {
        [key: string]: {
            name: string;
            lot: number;
        };
    } = {};

    // const lastTrades: { [key: string]: any; } = {}; // eslint-disable-line @typescript-eslint/no-explicit-any

    const allMarket: {
        [key: string]: string[];
    } = {
        buy: [],
        sell: [],
        wait: [],
    };

    const uids: string[] = [];

    for (let i = 0; i < allBaseShares.length; i++) {
        const { uid, ticker, name, lot } = allBaseShares[i];

        // if (![
        //     'TATNP',
        //     'BANE',
        //     'SBER', 'OZON', 'TATN', 'NLMK',
        // ].includes(ticker)) {
        //     continue;
        // }

        if (ticker !== 'TCSG' || // && ticker !== 'TATN' ||
            !dashboardTickes.map(d => d.uid).includes(uid)) {
            continue;
        }

        uids.push(uid);
        cachedUidTicker[uid] = {
            name: `${name} (${ticker})`,
            lot,
        };

        // break;
    }

    try {
        // const req = getSubscrRequest(uids.map(instrumentId => {
        //     return {
        //         instrumentId,
        //     };
        // }))

        console.log('Состояние рынка'); // eslint-disable-line no-console
        console.log('Продавать', allMarket.sell.length, 'Ждать', allMarket.wait.length); // eslint-disable-line no-console
        console.log('Покупать', allMarket.buy.length); // eslint-disable-line no-console
        console.log(allMarket.buy); // eslint-disable-line no-console

        const response = sdk.marketDataStream.marketDataStream(
            createSubscriptionTradesRequest(
                uids.map(instrumentId => {
                    return {
                        instrumentId,
                    };
                },
                ),
            ));

        const lastTrades: any = {}; // eslint-disable-line

        const MAXMINUTEPOINTER = 5;
        let minutePointer = 0;
        let prevMinute;

        const SECONDSWAIT = 10 * 1000;

        // const ALLDATATIMESTAT = 5 * 60 * 1000;
        let lastSec;
        let tradesInSecond: {
            [key: string]: {
                1: number;
                2: number;
            }
        } = {

        };

        // let positionsInfo = {
        //     signalBuy: false,
        //     signalSell: false,
        //     signalClose: false,
        // };

        const positions: {
            [key: string]: any;
        } = {};

        // @ts-ignore
        const allData: any = {
            trades: {},
            ob: {},
            lastMoney: {},
            lastPrint: {},
        };

        setInterval(() => {
            // const time = Date.now() - ALLDATATIMESTAT;

            Object.keys(allData.trades).forEach(i => {
                // allData.trades[i] = allData.trades[i].filter((t: { time: number; }) => t.time > time);
                allData.lastPrint[i] = false;
            });

            // Object.keys(allData.ob).forEach(i => {
            //     allData.ob[i] = allData.ob[i].filter((t: { time: number; }) => t.time > time);
            // });
        }, 5000);

        for await (const num of response) {
            // const allData = {
            //     trades: [],
            //     ob: [],
            // };

            const { trade, orderbook } = num || {};

            if (trade) {
                const { direction, quantity, instrumentUid, price } = trade;

                if (!allData.trades[instrumentUid]) {
                    allData.trades[instrumentUid] = [];
                }

                const lot = cachedUidTicker[instrumentUid].lot;
                const last = allData.trades[instrumentUid][allData.trades[instrumentUid].length - 1];
                const p = Common.getPrice(price) || 0;

                if (!last || last.direction !== direction || last.price !== p) {
                    allData.trades[instrumentUid].push({
                        time: Date.now(),
                        direction,
                        price: p,
                        quantity,
                        inMoney: p * quantity * lot * (direction === TradeDirection.TRADE_DIRECTION_BUY ? 1 : -1),
                    });
                } else {
                    last.time = Date.now();
                    const q = last.quantity + quantity;

                    last.quantity = q;
                    last.inMoney = last.quantity * last.price * lot * (direction === TradeDirection.TRADE_DIRECTION_BUY ? 1 : -1);
                }
            }

            if (orderbook && orderbook.isConsistent) {
                const { instrumentUid } = orderbook;

                const bids = orderbook.bids.map(b => b.quantity);
                const asks = orderbook.asks.map(b => b.quantity);
                const bidsMedian = Common.median(bids);
                const asksMedian = Common.median(asks);

                // const maxBids = orderbook.bids.sort((a, b) => {
                //     return b.quantity - a.quantity;
                // })
                //     .slice(0, 5);

                // const maxAsks = orderbook.asks.sort((a, b) => {
                //     return b.quantity - a.quantity;
                // })
                //     .slice(0, 5);

                const sumBids = bids.reduce((acc, val) => acc + val, 0);
                const sumAsks = asks.reduce((acc, val) => acc + val, 0);

                let { inMoney, sumMoneyUp, sumMoneyDown } = allData.trades?.[instrumentUid]?.reduce((acc: {
                    inMoney: number;
                    sumMoneyUp: number;
                    sumMoneyDown: number;
                }, val: { inMoney: number; direction: number; }) => {
                    return {
                        inMoney: acc.inMoney + val.inMoney,
                        sumMoneyUp: acc.sumMoneyUp + (val.direction === TradeDirection.TRADE_DIRECTION_BUY ? val.inMoney : 0),
                        sumMoneyDown: acc.sumMoneyDown + (val.direction === TradeDirection.TRADE_DIRECTION_SELL ? val.inMoney : 0),
                    };
                }, { inMoney: 0, sumMoneyUp: 0, sumMoneyDown: 0 }) || { inMoney: 0, sumMoneyUp: 0, sumMoneyDown: 0 };

                inMoney /= 1e6;
                sumMoneyUp /= 1e6;
                sumMoneyDown /= 1e6;

                if (!allData.lastPrint[instrumentUid]) {
                    if (1 || Math.abs(inMoney - allData.lastMoney[instrumentUid]) >= 1 && (sumMoneyUp > Math.abs(sumMoneyDown) && inMoney > 0 ||
                        sumMoneyUp < Math.abs(sumMoneyDown) && inMoney < 0)) {
                        console.log(1, cachedUidTicker[instrumentUid].name, 'sumBids', sumBids, 'bidsMedian', bidsMedian, '|',
                            'sumAsks', sumAsks, 'asksMedian', asksMedian);
                        console.log('inMoney', inMoney, 'sumMoneyUp', sumMoneyUp, 'sumMoneyDown', sumMoneyDown);
                        console.log();
                    }

                    allData.lastPrint[instrumentUid] = true;
                    allData.lastMoney[instrumentUid] = inMoney;

                    if (((sumBids > sumAsks * 1.5 && bidsMedian > asksMedian * 1.5 && inMoney > 10) ||
                        (sumAsks > sumBids * 1.5 && asksMedian > bidsMedian * 1.5 && inMoney < -10))
                    ) {
                        console.log(cachedUidTicker[instrumentUid].name);
                        console.log('sumBids', sumBids, 'sumAsks', sumAsks);
                        console.log('bidsMedian', bidsMedian, 'asksMedian', asksMedian);
                        console.log('inMoney', inMoney);
                        console.log(inMoney > 0 ? 'LONG' : 'SHORT');
                        console.log();

                        // console.log('maxBids', maxBids, 'maxAsks', maxAsks);
                    } else if (
                        // inMoney > 10 &&
                        inMoney > allData.lastMoney[instrumentUid] ||

                        // inMoney < -10 &&
                        inMoney < allData.lastMoney[instrumentUid]
                    ) {
                        //     // } else if ((inMoney - allData.lastMoney[instrumentUid]) / inMoney) {
                        console.log('else', cachedUidTicker[instrumentUid].name);
                        console.log('inMoney', inMoney.toFixed(2), ((inMoney - allData.lastMoney[instrumentUid]) / inMoney).toFixed(2));
                        console.log(((inMoney - allData.lastMoney[instrumentUid]) / inMoney) > 0 ? 'LONG' : 'SHORT');
                        console.log();

                        //     // console.log('bidsMedian', bidsMedian, 'asksMedian', asksMedian);

                        //     sdk.orders.postOrder({
                        //         quantity: 1,
                        //         direction: (inMoney - allData.lastMoney[instrumentUid]) / inMoney > 0 ?
                        //             OrderDirection.ORDER_DIRECTION_BUY : OrderDirection.ORDER_DIRECTION_SELL,
                        //         orderType: OrderType.ORDER_TYPE_BESTPRICE,
                        //         orderId: uuidv4(),
                        //         instrumentId: instrumentUid,
                        //         accountId: ACCOUNTID,
                        //     });
                    }
                }
            }

            if (1) {
                continue;
            }

            if (trade) {
                const { direction, quantity, instrumentUid } = trade;
                const curSec = Date.now();
                let signalBuy = false;
                let signalSell = false;

                if (!tradesInSecond[instrumentUid]) {
                    tradesInSecond[instrumentUid] = {
                        '1': 0,
                        '2': 0,
                    };
                }

                try {
                    tradesInSecond[instrumentUid][direction === TradeDirection.TRADE_DIRECTION_BUY ? 1 : 2] += quantity;

                    if (!lastSec && curSec) {
                        lastSec = curSec;

                        continue;
                    }

                    // console.log(trade); // eslint-disable-line no-console

                    if (tradesInSecond[instrumentUid][1] > 1000 && tradesInSecond[instrumentUid][2] * 10 < tradesInSecond[instrumentUid][1]) {
                        signalBuy = true;

                        //     positions[instrumentUid] = ((await sdk.operations.getPositions({
                        //         accountId: ACCOUNTID,
                        //     })) || {}).securities;

                        //     const pos = positions[instrumentUid].find((f: { instrumentUid: string; }) => f.instrumentUid === instrumentUid);

                        //     if (pos && (pos.blocked || pos.balance < 0)) {
                        //         continue;
                        //     }

                        //     console.log('buy', cachedUidTicker[instrumentUid]);
                        //     console.log(tradesInSecond[instrumentUid]);
                        //     haveTrade = true;

                        //     sdk.orders.postOrder({
                        //         quantity: 1,
                        //         direction: OrderDirection.ORDER_DIRECTION_BUY,
                        //         orderType: OrderType.ORDER_TYPE_BESTPRICE,
                        //         orderId: uuidv4(),
                        //         instrumentId: instrumentUid,
                        //         accountId: ACCOUNTID,
                        //     });
                    } else if (tradesInSecond[instrumentUid][2] > 1000 && tradesInSecond[instrumentUid][1] * 10 < tradesInSecond[instrumentUid][2]) {
                        signalSell = true;

                        //     console.log('SELL', cachedUidTicker[instrumentUid]);
                        //     console.log(tradesInSecond[instrumentUid]);

                        //     haveTrade = true;
                    }

                    if (signalBuy || signalSell) {
                        positions[instrumentUid] = ((await sdk.operations.getPositions({
                            accountId: ACCOUNTID,
                        })) || {}).securities;

                        const pos = positions[instrumentUid].find((f: { instrumentUid: string; }) => f.instrumentUid === instrumentUid);

                        if (pos && (pos.blocked)) {
                            continue;
                        }

                        const signalClose = Boolean(signalSell && signalBuy) ||
                            Boolean(signalSell && pos?.balance > 0) ||
                            Boolean(signalBuy && pos?.balance < 0);

                        if (0 && signalClose) {
                            // close
                            // console.log('need close');
                        } else if (signalBuy && (!pos?.balance || pos?.balance > 0)) {
                            console.log('BUY', cachedUidTicker[instrumentUid]);
                            console.log(tradesInSecond[instrumentUid]);

                            sdk.orders.postOrder({
                                quantity: 1,
                                direction: OrderDirection.ORDER_DIRECTION_BUY,
                                orderType: OrderType.ORDER_TYPE_BESTPRICE,
                                orderId: uuidv4(),
                                instrumentId: instrumentUid,
                                accountId: ACCOUNTID,
                            });
                        } else if (signalSell && (!pos?.balance || pos?.balance < 0)) {
                            console.log('SELL', cachedUidTicker[instrumentUid]);
                            console.log(tradesInSecond[instrumentUid]);

                            sdk.orders.postOrder({
                                quantity: 1,
                                direction: OrderDirection.ORDER_DIRECTION_SELL,
                                orderType: OrderType.ORDER_TYPE_BESTPRICE,
                                orderId: uuidv4(),
                                instrumentId: instrumentUid,
                                accountId: ACCOUNTID,
                            });
                        }
                    }

                    if (signalBuy || signalSell || lastSec && curSec && curSec - lastSec > SECONDSWAIT) {
                        lastSec = curSec;

                        if (!signalBuy && !signalSell) {
                            console.log('tradesInSecond NO', cachedUidTicker[instrumentUid]);
                            console.log(tradesInSecond[instrumentUid]);

                            // console.log(allData.trades[instrumentUid]);
                            console.log('total', allData.trades[instrumentUid].reduce((acc: { buy: any; sell: any; }, val: { direction: TradeDirection; quantity: any; }) => {
                                if (val.direction === TradeDirection.TRADE_DIRECTION_BUY) {
                                    acc.buy += val.quantity;
                                } else {
                                    acc.sell += val.quantity;
                                }

                                return acc;
                            }, { buy: 0, sell: 0 }));

                            if (allData.trades[instrumentUid][0].price > allData.trades[instrumentUid][allData.trades[instrumentUid].length - 1].price) {
                                console.log('price down');
                            } else if (allData.trades[instrumentUid][0].price < allData.trades[instrumentUid][allData.trades[instrumentUid].length - 1].price) {
                                console.log('price up');
                            } else {
                                console.log('price not change');
                            }
                        }

                        tradesInSecond[instrumentUid] = {
                            '1': 0,
                            '2': 0,
                        };
                    }

                    continue;
                } catch (e) {
                    console.log(e); // eslint-disable-line
                    await timer(60000);
                    tradesInSecond = {};
                }
            }

            if (trade) {
                const tMinutes = new Date().getMinutes();
                let needChangePointer = false;

                if (!prevMinute) {
                    prevMinute = tMinutes;
                }

                const { direction, quantity, instrumentUid, price } = trade;
                const priceNumber = Common.getPrice(price);

                if (!priceNumber) {
                    continue;
                }

                if (prevMinute !== tMinutes) {
                    needChangePointer = true;
                    prevMinute = tMinutes;
                    ++minutePointer;

                    if (minutePointer > MAXMINUTEPOINTER) {
                        minutePointer = 0;
                    }

                    console.log(new Date().toLocaleString()); // eslint-disable-line no-console

                    // console.log(lastTrades);
                    // console.log(JSON.stringify(lastTrades, null, 4));

                    // if (lastTrades[instrumentUid].every((t: {
                    //     buyQuantityCount: number; sellQuantityCount: number;
                    // }) => Boolean(t) && t.buyQuantityCount > 100 && t.sellQuantityCount < 10)) {
                    console.log(lastTrades); // eslint-disable-line no-console
                    // }
                }

                // if (!lastTrades.timeInMinutes) {
                //     lastTrades.timeInMinutes = tMinutes;
                // }

                if (!lastTrades[instrumentUid]) {
                    lastTrades[instrumentUid] = [];
                }

                if (!lastTrades[instrumentUid][minutePointer] || needChangePointer) {
                    lastTrades[instrumentUid][minutePointer] = {
                        timeInMinutes: tMinutes,
                        time: new Date().toLocaleString(),
                        ticker: cachedUidTicker[instrumentUid],
                        ...startData,
                    };
                }

                const uid = instrumentUid;

                if (direction === TradeDirection.TRADE_DIRECTION_BUY) {
                    lastTrades[uid][minutePointer].buyQuantityCount += quantity;

                    if (!lastTrades[uid][minutePointer].buyPrices[priceNumber]) {
                        lastTrades[uid][minutePointer].buyPrices[priceNumber] = quantity;
                    } else {
                        lastTrades[uid][minutePointer].buyPrices[priceNumber] = Number(quantity);
                    }
                } else if (direction === TradeDirection.TRADE_DIRECTION_SELL) {
                    lastTrades[uid][minutePointer].sellQuantityCount += quantity;

                    if (!lastTrades[uid][minutePointer].sellPrices[priceNumber]) {
                        lastTrades[uid][minutePointer].sellPrices[priceNumber] = quantity;
                    } else {
                        lastTrades[uid][minutePointer].sellPrices[priceNumber] = Number(quantity);
                    }
                }

                // console.log(cachedUidTicker[instrumentUid], direction, quantity);

                // console.log(JSON.stringify(num, null, 4)); // eslint-disable-line no-console
            }
        }
    } catch (e) {
        console.log(e); // eslint-disable-line
    }
})();

async function* createSubscriptionTradesRequest(
    instruments: { instrumentId: string; }[],
): AsyncIterable<DeepPartial<MarketDataRequest>> {
    const orderKeys: { depth: number; instrumentId: string; orderBookType: OrderBookType; }[] = [];

    instruments.forEach((f: { instrumentId: string; }) => {
        // @ts-ignore
        orderKeys.push({
            depth: 50,
            instrumentId: f.instrumentId,
            orderBookType: OrderBookType.ORDERBOOK_TYPE_EXCHANGE,
        });

        // @ts-ignore
        orderKeys.push({
            depth: 50,
            instrumentId: f.instrumentId,
            orderBookType: OrderBookType.ORDERBOOK_TYPE_DEALER,
        });
    });
    while (true) {
        yield MarketDataRequest.fromPartial({
            subscribeTradesRequest: {
                subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
                instruments,
            },
        });

        yield MarketDataRequest.fromPartial({
            subscribeOrderBookRequest: {
                subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
                instruments: orderKeys,
            },
        });

        // yield MarketDataRequest.fromPartial({
        //     subscribeTradesRequest: {
        //         subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
        //         instruments,
        //     },
        // });

        await timer(1000);
    }
}

setInterval(() => { }, 5000);
