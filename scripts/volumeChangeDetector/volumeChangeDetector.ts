// import { Candles } from '../../components/investAPI/candles';
import { createSdk } from 'tinkoff-sdk-grpc-js';
import { TOKEN } from '../../config';

import { Instruments } from '../../components/investAPI/instruments';
import { logger } from '../../src/utils';
import { TradeDirection } from 'tinkoff-sdk-grpc-js/dist/generated/marketdata';
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

    const to = new Date();
    const from = new Date(Date.now() - 3600000);

    const cachedUidTicker: { [key: string]: string; } = {};
    const lastTrades: { [key: string]: any; } = {}; // eslint-disable-line @typescript-eslint/no-explicit-any

    const allMarket: {
        [key: string]: string[];
    } = {
        buy: [],
        sell: [],
        wait: [],
    };

    // const uids: string[] = [];

    for (let i = 0; i < allBaseShares.length; i++) {
        const { uid, ticker, name } = allBaseShares[i];

        // if (ticker !== 'SBER') {
        //     continue;
        // }

        // uids.push(uid);
        cachedUidTicker[uid] = `${name} (${ticker})`;

        // continue;
        // const historicCandlesArr = await candlesSdk.getCandles(
        //     {
        //         instrumentId: uid,
        //         interval: sdk.CandleInterval.CANDLE_INTERVAL_1_MIN,
        //         from,
        //         to,
        //     },
        // );

        const { trades } = (await sdk.marketData.getLastTrades({
            instrumentId: uid,
            from,
            to,
        })) || {};

        lastTrades[uid] = {
            m60: { ...startData },
            m30: { ...startData },
            m15: { ...startData },
            m5: { ...startData },
            m2: { ...startData },
        };

        const periodsArr: string[] = [
            'm60', 'm30', 'm15', 'm5', 'm2',
        ];

        for (let j = 0; j < trades.length; j++) {
            const { price, direction, quantity, time } = trades[j];

            const priceNumber = Common.getPrice(price);

            if (!time || !priceNumber) {
                continue;
            }

            const tradeTime = new Date(time).getTime();
            const toTime = to.getTime();

            const periods: { [key: string]: number; } = {
                m60: toTime - 3600000,
                m30: toTime - 1800000,
                m15: toTime - 900000,
                m5: toTime - 300000,
                m2: toTime - 120000,
            };

            for (let k = 0; k < periodsArr.length; k++) {
                const pName = periodsArr[k];

                if (tradeTime >= periods[pName]) {
                    if (direction === TradeDirection.TRADE_DIRECTION_BUY) {
                        lastTrades[uid][pName].buyQuantityCount += quantity;

                        if (!lastTrades[uid][pName].buyPrices[priceNumber]) {
                            lastTrades[uid][pName].buyPrices[priceNumber] = quantity;
                        } else {
                            lastTrades[uid][pName].buyPrices[priceNumber] = Number(quantity);
                        }
                    } else if (direction === TradeDirection.TRADE_DIRECTION_SELL) {
                        lastTrades[uid][pName].sellQuantityCount += quantity;

                        if (!lastTrades[uid][pName].sellPrices[priceNumber]) {
                            lastTrades[uid][pName].sellPrices[priceNumber] = quantity;
                        } else {
                            lastTrades[uid][pName].sellPrices[priceNumber] = Number(quantity);
                        }
                    }
                }
            }
        }

        console.log(i, ticker, name); // eslint-disable-line no-console
        periodsArr.forEach(pName => {
            console.log(pName, lastTrades[uid][pName].sellQuantityCount, lastTrades[uid][pName].buyQuantityCount); // eslint-disable-line no-console
        });

        if (periodsArr.every(
            pName => lastTrades[uid][pName].sellQuantityCount > lastTrades[uid][pName].buyQuantityCount)
        ) {
            console.log('Продавать'); // eslint-disable-line no-console
            allMarket.sell.push(ticker);
        } else if (
            periodsArr.every(
                pName => lastTrades[uid][pName].sellQuantityCount < lastTrades[uid][pName].buyQuantityCount,
            )
        ) {
            allMarket.buy.push(ticker);
            console.log('Покупать'); // eslint-disable-line no-console
        } else {
            allMarket.wait.push(ticker);
            console.log('Ждать'); // eslint-disable-line no-console
        }

        // break;
    }

    try {
        console.log('Состояние рынка'); // eslint-disable-line no-console
        console.log('Продавать', allMarket.sell.length, 'Ждать', allMarket.wait.length); // eslint-disable-line no-console
        console.log('Покупать', allMarket.buy.length); // eslint-disable-line no-console
        console.log(allMarket.buy); // eslint-disable-line no-console
    } catch (e) {
        console.log(e); // eslint-disable-line
    }
})();
