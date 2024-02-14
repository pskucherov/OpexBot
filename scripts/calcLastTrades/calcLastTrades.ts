// @ts-nocheck
/* eslint @typescript-eslint/no-explicit-any: 0 */

import { Candles } from '../../components/investAPI/candles';
import { createSdk } from 'tinkoff-sdk-grpc-js';
import { TOKEN } from '../../config';

import { Instruments } from '../../components/investAPI/instruments';
import { logger } from '../../src/utils';

import { Common } from '../../src/Common/Common';
import { SecurityTradingStatus } from 'tinkoff-sdk-grpc-js/dist/generated/common';
import { TradeDirection } from 'tinkoff-sdk-grpc-js/dist/generated/marketdata';

const sdk = createSdk(TOKEN, 'backtester', logger);
const candlesSdk = new Candles(sdk);
const instruments = new Instruments(sdk);

const cachedUidTicker: any = {};

const allTrades: {
    [key: string]: {
        buy: {
            [key: string]: any;
        };
        sell: {
            [key: string]: any;
        };
        statBuyQuantity: number;
        statSellQuantity: number;
    };
} = {};

(async () => {
    try {
        const allBaseShares = ((await instruments.getAllShares()).filter(s => s.currency === 'rub'));

        for (let i = 0; i < allBaseShares.length; i++) {
            const { uid, ticker, name, currency, tradingStatus } = allBaseShares[i];

            if (ticker !== 'UWGN') {
                continue;
            }

            cachedUidTicker[uid] = `${name} (${ticker})`;

            const id = allBaseShares[i].uid;

            const { trades } = await sdk.marketData.getLastTrades({
                instrumentId: id,
            });

            // const q = await sdk.marketData.getOrderBook({
            //     instrumentId: id,
            //     depth: 5,
            // });

            const w = await sdk.marketData.getOrderBook({
                instrumentId: id,
                depth: 50,
            });

            // console.log(q);
            console.log(w);

            // qwe

            for (let j = 0; j < trades?.length || 0; j++) {
                if (!allTrades[uid]) {
                    allTrades[uid] = {
                        statBuyQuantity: 0,
                        statSellQuantity: 0,
                    };
                }

                const price = Common.getPrice(trades[j].price);

                if (!allTrades[uid][price]) {
                    allTrades[uid][price] = {
                        buyStat: 0,
                        sellStat: 0,
                        buy: [],
                        sell: [],
                        price: trades[j].price,
                    };
                }

                if (trades[j].direction === TradeDirection.TRADE_DIRECTION_BUY) {
                    // allTrades[uid][price].buy.push(trades[j]);
                    allTrades[uid][price].buyStat += trades[j].quantity;
                    allTrades[uid].statBuyQuantity += trades[j].quantity;
                } else {
                    // allTrades[uid][price].sell.push(trades[j]);
                    allTrades[uid][price].sellStat += trades[j].quantity;
                    allTrades[uid].statSellQuantity += trades[j].quantity;
                }
            }

            if (allTrades[uid]) {
                console.log(ticker, allTrades[uid], 'statBuyQuantity', allTrades[uid].statBuyQuantity);
                console.log(ticker, allTrades[uid], 'statSellQuantity', allTrades[uid].statSellQuantity);
                console.log();
            }

            // console.log(ticker, trades?.[0]?.time);
            // console.log(ticker, q.trades[0]);

            // if (!q.trades[0]) {
            //     console.log(q);
            // }
        }
    } catch (e) {
        console.log(e); // eslint-disable-line no-console
    }
})();
