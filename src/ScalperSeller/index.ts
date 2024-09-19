/* eslint-disable */
// черновик

// const { throws } = require('assert');
// const { parse } = require('path');

// import { Quotation } from "tinkoff-sdk-grpc-js/dist/generated/common";
// import { StopOrderStatusOption, StopOrderDirection, StopOrderExpirationType, StopOrderType } from 'tinkoff-sdk-grpc-js/dist/generated/stoporders';
import { Common } from '../Common/TsCommon';

// import { Quotation } from 'tinkoff-sdk-grpc-js/dist/generated/common';
import { Share } from 'tinkoff-sdk-grpc-js/dist/generated/instruments';
import { TRequests as TRequestsBase } from '../TRequests/TRequests';
import { GetTechAnalysisRequest_IndicatorInterval, GetTechAnalysisRequest_IndicatorType, GetTechAnalysisRequest_TypeOfPrice, LastPrice, Trade, TradeDirection } from 'tinkoff-sdk-grpc-js/dist/generated/marketdata';
import { MoneyValue, Quotation } from 'tinkoff-sdk-grpc-js/dist/generated/common';
import { OrderType, TimeInForceType } from 'tinkoff-sdk-grpc-js/dist/generated/orders';

// import { InstrumentStatus } from "tinkoff-sdk-grpc-js/dist/generated/instruments";

interface ITradeStatsDirection {
    trades?: Trade[],
    quantity: number,
    prices: {
        [price: number]: number;
    }
}
interface ITradeStats {
    buy: ITradeStatsDirection;
    sell: ITradeStatsDirection;
}

try {
    const path = require('path');
    const name = __dirname.split(path.sep).pop();

    /**
     * Заготовка торгового робота.
     */
    class Bot extends Common {
        // // instrument — торгует одним инструментом. portfolio — всем портфелем.
        // static type = 'autoprofit';
        name: string | undefined;

        decisionBuyPositionMessage!: string;
        decisionClosePositionMessage!: string | number;
        allInstrumentsInfo: {
            [key: string]: Share
        } = {};
        TRequests: InstanceType<typeof TRequestsBase> | undefined;
        // maxLotPrice: number;
        rsiMonth: number;
        rsiWeek: number;
        rsiDay: number;

        // @ts-ignore
        constructor(...args) {
            // @ts-ignore
            super(...args);

            // this.type = Bot.type;
            this.isPortfolio = false;
            this.name = name;

            // this.maxLotPrice = 5000;
            this.rsiMonth = 70;
            this.rsiWeek = 60;
            this.rsiDay = 60;

            // Запуск робота каждые 15 секунд.
            this.robotTimer = 60 * 1000;
        }

        async getLastTradesStat(uid: string, top = 5, lastMins = 0, lastSec = 0, fromDate?: Date, toDate?: Date) {
            try {
                const to = fromDate || new Date();
                const from = toDate || new Date();

                if (!fromDate) {
                    from.setUTCMinutes(from.getUTCMinutes() - lastMins);
                    from.setUTCSeconds(from.getUTCSeconds() - lastSec);
                }

                // from.setUTCHours(from.getUTCHours() + 5);
                // to.setUTCHours(to.getUTCHours() + 5);

                // from.setUTCDate(from.getUTCDate() - 12);
                // to.setUTCDate(to.getUTCDate() - 12);

                // console.log('getLastTradesStat', from, to);
                // console.log(await this.TRequests?.getLastTrades(uid, from, to));

                const { trades } = ((!lastMins && !lastSec && !fromDate) ? await this.TRequests?.getLastTrades(uid) :
                    await this.TRequests?.getLastTrades(uid, from, to)) ||
                    {};

                //     lastSec &&
                // console.log(from, to, trades);
                const tradeStat = trades?.reduce((acc: ITradeStats, val: Trade) => {
                    let current: ITradeStatsDirection;

                    if (val.direction === TradeDirection.TRADE_DIRECTION_SELL) {
                        // acc.sell?.trades.push(val);
                        current = acc.sell;
                    } else {
                        // acc.buy?.trades.push(val);
                        current = acc.buy;
                    }

                    current.quantity += val.quantity;
                    const price = this.getPrice(val.price) || 0;

                    if (!price) {
                        return acc;
                    }

                    if (!current.prices[price]) {
                        current.prices[price] = val.quantity;
                    } else {
                        current.prices[price] += val.quantity;
                    }

                    return acc;
                }, {
                    buy: {
                        // trades: [],
                        quantity: 0,
                        prices: {},
                    },
                    sell: {
                        // trades: [],
                        quantity: 0,
                        prices: {},
                    },
                });

                const pricesSorted: any = {
                    buy: [],
                    sell: [],
                };

                ['buy', 'sell'].forEach(name => {
                    if (!tradeStat?.[name]?.prices) {
                        return;
                    }

                    pricesSorted[name] = Object.keys(tradeStat[name].prices)
                        .map(price => {
                            return {
                                quantity: tradeStat[name].prices[price],
                                price: Number(price),
                            };
                        })
                        .sort((a, b) => b.quantity - a.quantity)//.map(t => t.price + ':' + t.quantity)
                        .slice(0, top);
                });

                // console.log('buy');
                // console.log(tradeStat.buy?.quantity);
                // // console.log(JSON.stringify(t.buy?.prices, null, 4));
                // console.log(JSON.stringify(pricesSorted.buy, null, 4));

                // console.log('sell');
                // console.log(tradeStat.sell?.quantity);
                // // console.log(JSON.stringify(t.sell?.prices, null, 4));
                // console.log(JSON.stringify(pricesSorted.sell, null, 4));

                return {
                    ...tradeStat,
                    pricesSorted,
                };
            } catch (e) {
                console.log(e); // eslint-disable-line
            }
        }

        async processing() { // eslint-disable-line

            try {
                if (!this.inProgress || !Object.keys(this.allInstrumentsInfo).length) {
                    await super.processing();

                    return;
                }

                console.log(new Date().toLocaleTimeString(), this.name, '\r\n\r\n\r\n STAAAAAART!!!! \r\n\r\n\r\n'); // , this.allInstrumentsInfo && Object.keys(this.allInstrumentsInfo).length);

                const sdk = this.sdk;
                const accountId = this.accountId;

                if (!sdk || !accountId) {
                    console.log(1);
                    await super.processing();

                    return;
                }

                const shares = await this.getSharesForTrading({
                    // maxLotPrice: this.maxLotPrice,
                });

                if (!shares) {
                    console.log(2);
                    await super.processing();

                    return;
                }

                const keys = Object.keys(shares);
                const { lastPrices } = await this.TRequests?.getLastPrices(keys) || {};

                const allData = [];

                // const lastMinMaxTrades = [];

                const volData = [];
                const volDataStatLastMin = [];

                console.log(keys.length);

                for (let i = 0; i < keys.length; i++) {
                    try {
                        // if (this.allInstrumentsInfo[keys[i]].ticker !== 'SBER') {
                        //     continue;
                        // }

                        const ticker = this.allInstrumentsInfo[keys[i]].ticker;
                        const stat = await this.getLastTradesStat(keys[i], 20);

                        const statLastFiveMin = await this.getLastTradesStat(keys[i], 20, 5);
                        const statLastMin = await this.getLastTradesStat(keys[i], 20, 1);

                        // const statLast10Sec = await this.getLastTradesStat(keys[i], 20, 0, 10);

                        const curStat = stat;

                        if (!curStat) {
                            console.log('ticker continue', this.allInstrumentsInfo[keys[i]].ticker);
                            continue;
                        }

                        // const debug = (stat: any) => {
                        //     const qBuy = stat.buy?.quantity;
                        //     const qSell = stat.sell?.quantity;
                        //     const percent = (qBuy - qSell) / qBuy;
                        //     console.log(this.allInstrumentsInfo[keys[i]].ticker, `buy ${qBuy}, sell ${qSell}, ${percent} %`)
                        //     console.log('buy');
                        //     console.log(JSON.stringify(stat.pricesSorted.buy?.map((b: { price: string; quantity: string; }) => b.price + ':' + b.quantity), null, 4));
                        //     console.log('sell');
                        //     console.log(JSON.stringify(stat.pricesSorted.sell?.map((b: { price: string; quantity: string; }) => b.price + ':' + b.quantity), null, 4));
                        // };

                        const lastPrice = lastPrices.find((f: LastPrice) => f.instrumentUid === keys[i]);

                        const lp = (this.getPrice(lastPrice?.price) || 0);

                        volData.push({
                            // ...statLastMin,
                            ticker,
                            uid: keys[i],
                            buyPrice: curStat.pricesSorted?.buy[0]?.price,
                            sellPrice: curStat.pricesSorted?.sell[0]?.price,
                            lp,
                            lastPrice,
                            qBuy: curStat.buy?.quantity,
                            qSell: curStat.sell?.quantity,
                            qBSPerc: (curStat.buy?.quantity - curStat.sell?.quantity) / curStat.buy?.quantity,
                            volBuy: curStat.buy?.quantity * lp * this.allInstrumentsInfo[keys[i]].lot,
                            volSell: curStat.sell?.quantity * lp * this.allInstrumentsInfo[keys[i]].lot,
                            volDelta: (curStat.buy?.quantity - curStat.sell?.quantity) * lp * this.allInstrumentsInfo[keys[i]].lot,
                            volDeltaPerc: (curStat.buy?.quantity - curStat.sell?.quantity) / curStat.buy?.quantity,
                        });

                        volDataStatLastMin.push({
                            // ...statLastMin,
                            ticker,
                            uid: keys[i],
                            buyPrice: statLastMin.pricesSorted?.buy[0]?.price,
                            sellPrice: statLastMin.pricesSorted?.sell[0]?.price,
                            lp,
                            lastPrice,
                            qBuy: statLastMin.buy?.quantity,
                            qSell: statLastMin.sell?.quantity,
                            qBSPerc: (statLastMin.buy?.quantity - statLastMin.sell?.quantity) / statLastMin.buy?.quantity,
                            volBuy: statLastMin.buy?.quantity * lp * this.allInstrumentsInfo[keys[i]].lot,
                            volSell: statLastMin.sell?.quantity * lp * this.allInstrumentsInfo[keys[i]].lot,
                            volDelta: (statLastMin.buy?.quantity - statLastMin.sell?.quantity) * lp * this.allInstrumentsInfo[keys[i]].lot,
                            volDeltaPerc: (statLastMin.buy?.quantity - statLastMin.sell?.quantity) / statLastMin.buy?.quantity,
                        });

                        // console.log("ALL");
                        // console.log('lastPrice', lastPrice);
                        // debug(stat);

                        // console.log("LAST FIVE MIN");
                        // debug(statLastFiveMin);
                        // console.log('lastPrice', lastPrice);

                        const odVolume = await this.getOrderBookVolumeRatio(keys[i]);

                        // console.log(JSON.stringify(d, null, 4));

                        const qBuy = stat.buy?.quantity;
                        const qSell = stat.sell?.quantity;
                        const percent = (qBuy - qSell) / qBuy || 0;

                        // console.log(this.allInstrumentsInfo[keys[i]].ticker, 'odVolume?.bidAsk', odVolume?.bidAsk, 'percent', percent);

                        allData.push({
                            uid: keys[i],
                            ticker,
                            buy: qBuy,
                            sell: qSell,
                            topBuyPrice: stat.pricesSorted.buy[0],
                            topSellPrice: stat.pricesSorted.sell[0],
                            topFiveMinBuyPrice: statLastFiveMin.pricesSorted.buy[0],
                            topFiveMinSellPrice: statLastFiveMin.pricesSorted.sell[0],
                            lastPrice,
                            percent,
                            odVolume,
                        });

                        // console.log('tradesBuy', this.TRequests?.getAllTradesAggregated(keys[i]));
                        // console.log('tradesBuy', ticker);
                        // console.log(this.TRequests?.getAllTradesAggregatedStat(keys[i]));
                    } catch (e) {
                        console.log(e);
                    }
                }

                // const volAllDataBuy = volData.sort((a, b) => b.volDelta - a.volDelta);
                const volAllDataBuyMin = volDataStatLastMin.sort((a, b) => b.volDelta - a.volDelta);

                // const volAllDataSell = volData.sort((a, b) => b.volSell - a.volSell);

                // 0 && console.log('volAllDataBuy', volAllDataBuy[0]);
                // console.log(volAllDataBuyMin?.[0].uid);

                if (!volAllDataBuyMin?.length) {
                    await super.processing();

                    return;
                }

                const topBuyWithDelta: any[] = [
                    {
                        ...volAllDataBuyMin[0],
                        stat: this.TRequests?.getAllTradesAggregatedStat(volAllDataBuyMin[0]?.uid),
                    },
                    {
                        ...volAllDataBuyMin[volAllDataBuyMin.length - 1],
                        stat: this.TRequests?.getAllTradesAggregatedStat(volAllDataBuyMin[volAllDataBuyMin.length - 1]?.uid),
                    },
                ];

                /*
                console.log(volAllDataBuyMin?.[0]?.uid);

                console.log('tradesBuy', this.TRequests?.getAllTradesAggregatedStat(volAllDataBuyMin[0]?.uid))
                console.log('tradesSell', this.TRequests?.getAllTradesAggregatedStat(volAllDataBuyMin[volAllDataBuyMin.length - 1]?.uid))

                console.log('volAllDataBuyMin', volAllDataBuyMin[0]);
                console.log('volAllDataSell', volAllDataBuyMin[volAllDataBuyMin.length - 1]);

                if (1) {
                    await super.processing();
                    return;
                };
                // const dataSorted = allData.sort((a, b) => b.percent - a.percent);
                // const dataSorted = allData.filter(b => !!b?.odVolume?.bidAsk).sort((a, b) => (b?.odVolume?.bidAsk || 0) - (a?.odVolume?.bidAsk || 0));
                // const topBuy = dataSorted[0];
                // const topSell = dataSorted[dataSorted.length - 1];

                let topBuyWithDelta: any[] = [];
                allData.filter(
                    p => p.percent < -0.1 // p.odVolume?.bidAsk && p.odVolume?.bidAsk < -3
                    //  && p.percent < -0.1
                ).forEach(topBuy => {
                    const tBuy = Math.max(topBuy?.topBuyPrice?.price || 0, topBuy?.topFiveMinBuyPrice?.price || 0);
                    const tSell = Math.min(topBuy?.topSellPrice?.price || 0, topBuy?.topFiveMinSellPrice?.price || 0);
                    const curPrice = this.getPrice(topBuy?.lastPrice?.price) || 0;
                    const tBS = ((tBuy - tSell) / tBuy);

                    console.log('seller', topBuy?.ticker, topBuy?.percent, tBS, tBuy, tSell);
                    if (tBuy && tSell && Math.abs(tBS) > 0.0015 && curPrice > Math.max(tBuy, tSell)) {
                        topBuyWithDelta.push(
                            {
                                ...topBuy,
                                tBS: Math.abs(tBS),
                            }
                        );

                        console.log(topBuy?.ticker, tBS);
                        // console.log(JSON.stringify(topBuy, null, 4));
                        // console.log();
                        // console.log(topBuy?.topBuyPrice, topBuy?.topSellPrice);
                        // console.log(topBuy?.topFiveMinBuyPrice, topBuy?.topFiveMinSellPrice);
                        // console.log(tBuy, tSell, tBS);
                    }
                });

                if (topBuyWithDelta.length > 3) {
                    topBuyWithDelta = topBuyWithDelta.sort((a, b) => b.tBS - a.tBS).slice(0, 3);
                }

                console.log('topBuyWithDelta', topBuyWithDelta.length);
                console.log(JSON.stringify(topBuyWithDelta, null, 4));

                */

                for (let i = 0; i < topBuyWithDelta.length; i++) {
                    const instrument = topBuyWithDelta[i];

                    console.log('instrument', instrument);

                    if (instrument.stat.buy.sumPerc > Math.abs(instrument.stat.sell.sumPerc) &&
                        instrument.stat.buy.q > instrument.stat.sell.q * 3
                    ) {
                        console.log('buy');
                        console.log({
                            ticker: instrument.ticker,
                            accountId: this.accountId,
                            instrumentId: instrument.uid,
                            quantity: -1,
                            price: instrument.lastPrice.price,
                            orderType: OrderType.ORDER_TYPE_LIMIT,
                            timeInForceType: TimeInForceType.TIME_IN_FORCE_FILL_OR_KILL,
                        });
                    }

                    if (1) { continue }

                    await Bot.order(this.sdk, {
                        accountId: this.accountId,
                        instrumentId: instrument.uid,
                        quantity: -1,
                        price: instrument.lastPrice.price,
                        orderType: OrderType.ORDER_TYPE_LIMIT,
                        timeInForceType: TimeInForceType.TIME_IN_FORCE_FILL_OR_KILL,
                    });
                }

                // if (1) {
                //     await super.processing();
                //     return;
                // };

                if (1) return;

                const ww = await this.getTopInstruments(keys);

                console.log(ww);

                // const o = [];
                // for (let i = 0; i < keys.length; i++) {
                //     const d = await this.getOrderBookVolumeRatio(keys[i]);

                //     o.push({
                //         uid: keys[i],
                //         ...d,
                //     });
                // }

                // const oo = o.sort((a, b) => Number(b?.bidAsk) - Number(a?.bidAsk));
                // console.log(shares[oo[0].uid].ticker, oo[0]);
                // console.log(shares[oo[oo.length - 1].uid].ticker, oo[oo.length - 1]);

                await this.syncPos();

                const isSync = Boolean(this.currentPositions?.every(p =>

                    // @ts-ignore
                    p?.quantity?.units && p?.quantity?.units === p?.balance && !p?.blocked,
                ));

                if (!isSync) {
                    await super.processing();

                    return;
                }

                const { positions } = this.currentPortfolio || {};

                if (!positions?.length) {
                    await super.processing();

                    return;
                }

                // const { stopOrders } = await sdk.stopOrders.getStopOrders({
                //     accountId,
                //     status: StopOrderStatusOption.STOP_ORDER_STATUS_ACTIVE,
                // });

                await this.updateOrders();

                for (let j = 0; j < positions.length; j++) {
                    const {
                        // instrumentType,
                        // quantity,
                        averagePositionPrice,
                        instrumentUid,

                        // currentPrice,
                    } = positions[j];

                    const instrumentInOrders = this.currentOrders.find(o => o.instrumentUid === instrumentUid);

                    if (
                        // instrumentType !== 'share' ||
                        !averagePositionPrice ||
                        !this.allInstrumentsInfo?.[instrumentUid]?.lot ||

                        // Если по инструменту выставлена активная заявка, то стоп не ставим.
                        instrumentInOrders
                    ) {
                        continue;
                    }

                    if (this.hasBlockedPositions(instrumentUid)) {
                        this.decisionBuyPositionMessage = 'decisionBuy: есть блокированные позиции.';

                        await super.processing();

                        return;
                    }

                    const averagePositionPriceVal = Common.getPrice(averagePositionPrice);

                    if (!averagePositionPrice || !averagePositionPriceVal ||
                        !this.allInstrumentsInfo[instrumentUid]?.lot) {
                        continue;
                    }

                    const min = this.allInstrumentsInfo[instrumentUid].minPriceIncrement;

                    if (!min) {
                        continue;
                    }
                }
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }

            await super.processing();
        }

        /**
         * Рассчитывает процентное отношение объёмов покупки, к объёмам продажи в стакане для инструмента.
         *
         * @param uid
         * @returns
         */
        async getOrderBookVolumeRatio(uid: string) {
            try {
                const orderBookData = (await this.TRequests?.getOrderBook(uid)) || {};
                const { bids, asks } = orderBookData;

                let bidsQuantity = 0;

                for (let j = 0; j < bids?.length; j++) {
                    bidsQuantity += bids[j].quantity;
                }

                let asksQuantity = 0;

                for (let j = 0; j < asks?.length; j++) {
                    asksQuantity += asks[j].quantity;
                }

                if (bidsQuantity && asksQuantity) {
                    return {
                        bid: bidsQuantity,
                        ask: asksQuantity,
                        bidAsk: (bidsQuantity - asksQuantity) / bidsQuantity,
                        top5Bids: bids
                            .sort((a: { quantity: number; }, b: { quantity: number; }) => b.quantity - a.quantity)
                            .slice(0, 10)
                            .map((t: { price: MoneyValue | Quotation | undefined; }) => {
                                return {
                                    ...t,
                                    price: this.getPrice(t.price),
                                };
                            }),
                        top5Asks: asks.sort((a: { quantity: number; }, b: { quantity: number; }) => b.quantity - a.quantity).slice(0, 10)
                            .map((t: { price: MoneyValue | Quotation | undefined; }) => {
                                return {
                                    ...t,
                                    price: this.getPrice(t.price),
                                };
                            }),
                    };
                }
            } catch (e) {
                console.log(e); // eslint-disable-line
            }

            return undefined;
        }

        async getRsiData(instrumentUID: string) {
            const instrument = this.allInstrumentsInfo[instrumentUID];

            if (instrument) {
                const from = new Date();

                from.setDate(from.getDate() - 365);

                const to = new Date();

                try {
                    const { technicalIndicators: technicalIndicatorsMonth } = (await this.TRequests?.getMarketTechAnalysis({
                        indicatorType: GetTechAnalysisRequest_IndicatorType.INDICATOR_TYPE_RSI, /* eslint-disable-line camelcase */
                        instrumentUid: instrumentUID,
                        from,
                        to,
                        interval: GetTechAnalysisRequest_IndicatorInterval.INDICATOR_INTERVAL_MONTH, /* eslint-disable-line camelcase */
                        typeOfPrice: GetTechAnalysisRequest_TypeOfPrice.TYPE_OF_PRICE_CLOSE, /* eslint-disable-line camelcase */
                        length: 12,
                    })) || {};

                    const { technicalIndicators: technicalIndicatorsWeek } = (await this.TRequests?.getMarketTechAnalysis({
                        indicatorType: GetTechAnalysisRequest_IndicatorType.INDICATOR_TYPE_RSI, /* eslint-disable-line camelcase */
                        instrumentUid: instrumentUID,
                        from,
                        to,
                        interval: GetTechAnalysisRequest_IndicatorInterval.INDICATOR_INTERVAL_WEEK, /* eslint-disable-line camelcase */
                        typeOfPrice: GetTechAnalysisRequest_TypeOfPrice.TYPE_OF_PRICE_CLOSE, /* eslint-disable-line camelcase */
                        length: 52,
                    })) || {};

                    const { technicalIndicators: technicalIndicatorsDay } = (await this.TRequests?.getMarketTechAnalysis({
                        indicatorType: GetTechAnalysisRequest_IndicatorType.INDICATOR_TYPE_RSI, /* eslint-disable-line camelcase */
                        instrumentUid: instrumentUID,
                        from,
                        to,
                        interval: GetTechAnalysisRequest_IndicatorInterval.INDICATOR_INTERVAL_ONE_DAY, /* eslint-disable-line camelcase */
                        typeOfPrice: GetTechAnalysisRequest_TypeOfPrice.TYPE_OF_PRICE_CLOSE, /* eslint-disable-line camelcase */
                        length: 14,
                    })) || {};

                    if (
                        !technicalIndicatorsMonth.length ||
                        !technicalIndicatorsWeek.length ||
                        !technicalIndicatorsDay.length
                    ) {
                        return undefined;
                    }

                    const currentMonthRsiMonth = Common.getPrice(
                        technicalIndicatorsMonth[technicalIndicatorsMonth.length - 1].signal,
                    );

                    const currentMonthRsiWeek = Common.getPrice(
                        technicalIndicatorsWeek[technicalIndicatorsWeek.length - 1].signal,
                    );
                    const currentMonthRsiDay = Common.getPrice(
                        technicalIndicatorsDay[technicalIndicatorsDay.length - 1].signal,
                    );

                    if (currentMonthRsiMonth && currentMonthRsiWeek && currentMonthRsiDay) {
                        return {
                            currentMonthRsiMonth,
                            currentMonthRsiWeek,
                            currentMonthRsiDay,
                            uid: instrumentUID,
                            ticker: instrument.ticker,
                            orderBookRatio: await this.getOrderBookVolumeRatio(instrumentUID),
                        };
                    }
                } catch (e) {
                    console.log(e); // eslint-disable-line no-console

                    return undefined;
                }

                return undefined;
            }

            return undefined;
        }

        async getTopInstruments(uids: string[], size: number = 10) {
            let i = 1;
            const results = [];

            for (const uid of uids) {
                const data = (await this.getRsiData(uid));

                console.log(i, uids.length, uid);

                if (typeof data !== 'undefined') {
                    results.push(data);
                }

                ++i;
            }

            const instrumentsResult = results
                .filter((r: any) => Boolean(r))
                .sort((a: { currentMonthRsiMonth: number; }, b: { currentMonthRsiMonth: number; }) => {
                    return b.currentMonthRsiMonth - a.currentMonthRsiMonth;
                })
                .filter((f: {
                    currentMonthRsiMonth: number;
                    currentMonthRsiWeek: number;
                    currentMonthRsiDay: number;
                }) => f.currentMonthRsiMonth > this.rsiMonth &&
                f.currentMonthRsiWeek > this.rsiWeek &&
                    f.currentMonthRsiDay > this.rsiDay,
                )
                .slice(0, size);

            instrumentsResult.forEach((b: any, k: number) => {
                console.log(k + 1, b); // eslint-disable-line no-console
            });

            return instrumentsResult;
        }
    }

    if (name) {
        module.exports[name] = Bot;
    }
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
