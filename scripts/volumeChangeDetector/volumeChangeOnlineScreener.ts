// import { Candles } from '../../components/investAPI/candles';
import { createSdk } from 'tinkoff-sdk-grpc-js';
import { TOKEN } from '../../config';

import { Instruments } from '../../components/investAPI/instruments';
import { logger } from '../../src/utils';
import { DeepPartial, MarketDataRequest, SubscriptionAction, TradeDirection } from 'tinkoff-sdk-grpc-js/dist/generated/marketdata';
import { Common } from '../../src/Common/TsCommon';

// import { Common } from '../../src/Common/Common';

const sdk = createSdk(TOKEN, 'backtester', logger);

// const candlesSdk = new Candles(sdk);
const instruments = new Instruments(sdk);

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

    const cachedUidTicker: { [key: string]: string; } = {};

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
        const { uid, ticker, name } = allBaseShares[i];

        if (![
            'TATNP',
            'BANE',
            'SBER', 'OZON', 'TATN', 'NLMK',
        ].includes(ticker)) {
            continue;
        }

        uids.push(uid);
        cachedUidTicker[uid] = `${name} (${ticker})`;

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

        for await (const num of response) {
            const { trade } = num || {};

            if (trade) {
                console.log(trade); // eslint-disable-line no-console

                // continue;
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

const timer = (time: number) => new Promise(resolve => setTimeout(resolve, time));

async function* createSubscriptionTradesRequest(
    instruments: { instrumentId: string; }[],
): AsyncIterable<DeepPartial<MarketDataRequest>> {
    while (true) {
        await timer(1);
        yield MarketDataRequest.fromPartial({
            subscribeTradesRequest: {
                subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
                instruments,
            },
        });
    }
}

setInterval(() => { }, 5000);
