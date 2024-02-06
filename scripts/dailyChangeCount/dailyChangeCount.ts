// @ts-nocheck
/* eslint @typescript-eslint/no-explicit-any: 0 */

import { Candles } from '../../components/investAPI/candles';
import { createSdk } from 'tinkoff-sdk-grpc-js';
import { TOKEN } from '../../config';

import { Instruments } from '../../components/investAPI/instruments';
import { logger } from '../../src/utils';

import { Common } from '../../src/Common/Common';

const sdk = createSdk(TOKEN, 'backtester', logger);
const candlesSdk = new Candles(sdk);
const instruments = new Instruments(sdk);

(async () => {
    const allBaseShares = (await instruments.getAllShares()).filter(f => f.currency === 'rub');

    const to = new Date();
    const from = new Date();

    from.setDate(from.getDate() - 90);
    from.setUTCHours(0, 0, 0, 0);

    let data = [];
    let allMinVol = 0;
    let allMaxVol = 0;

    const plusByDay: { [key: string]: any; } = {};
    const minusByDay: { [key: string]: any; } = {};
    const cachedUidTicker: { [key: string]: any; } = {};

    for (let i = 0; i < allBaseShares.length; i++) {
        const { uid, ticker, name } = allBaseShares[i];

        cachedUidTicker[uid] = `${name} (${ticker})`;

        const historicCandlesArr = await candlesSdk.getCandles(
            {
                instrumentId: uid,
                interval: sdk.CandleInterval.CANDLE_INTERVAL_DAY,
                from,
                to,
            },
        );

        console.log(i, uid, ticker, name, historicCandlesArr.length); // eslint-disable-line no-console

        const stat: {
            [key: number]: any;
        } = {};

        let cMin = 0;
        let cPlus = 0;

        let minVol = 0;
        let maxVol = 0;

        for (let j = 0; j < historicCandlesArr.length; j++) {
            const { open, close, time, volume } = historicCandlesArr[j];

            if (!i && volume) {
                minVol = volume;
                maxVol = volume;
                allMinVol = volume;
                allMaxVol = volume;
            } else if (volume) {
                minVol = minVol ? Math.min(minVol, volume) : volume;
                maxVol = Math.max(maxVol, volume);
                allMinVol = allMinVol ? Math.min(allMinVol, volume) : volume;
                allMaxVol = Math.max(allMaxVol, volume);
            }

            const cPrice = Common.getPrice(close);
            const delta = Math.round(((cPrice - Common.getPrice(open)) / cPrice) * 100);

            if (delta) {
                if (!stat[delta]) {
                    stat[delta] = {
                        cnt: 1,
                        days: [time],
                        volumes: [volume],
                    };
                } else {
                    ++stat[delta].cnt;
                    stat[delta].days.push(time);
                    stat[delta].volumes.push(volume);
                }
            }

            if (delta >= 2) {
                cPlus++;

                if (time) {
                    if (!plusByDay[time.toLocaleDateString()]) {
                        plusByDay[time.toLocaleDateString()] = [];
                    }

                    plusByDay[time.toLocaleDateString()].push({
                        ...historicCandlesArr[j],
                        uid, ticker, name,
                    });
                }
            } else if (delta <= -2) {
                cMin++;

                if (time) {
                    if (!minusByDay[time.toLocaleDateString()]) {
                        minusByDay[time.toLocaleDateString()] = [];
                    }
                    minusByDay[time.toLocaleDateString()].push({
                        ...historicCandlesArr[j],
                        uid, ticker, name,
                    });
                }
            }
        }

        data.push({
            uid, ticker, name, stat, cMin, cPlus, minVol, maxVol,
        });
    }

    const avgVol = (allMinVol + allMaxVol) / 2;

    console.log(data.length); // eslint-disable-line no-console

    data = data.filter(d => d.maxVol > (allMaxVol / 30));

    console.log(allMinVol); // eslint-disable-line no-console
    console.log(allMaxVol); // eslint-disable-line no-console
    console.log(avgVol); // eslint-disable-line no-console
    console.log(data.length); // eslint-disable-line no-console

    console.log(); // eslint-disable-line no-console

    let d = data.sort((a, b) => b.cPlus - a.cPlus).slice(0, 10);

    console.log('plus'); // eslint-disable-line no-console
    for (let i = 0; i < d.length; i++) {
        // console.log(JSON.stringify(d[i], null, 4)); // eslint-disable-line no-console
        console.log(d[i]); // eslint-disable-line no-console
    }

    d = data.sort((a, b) => b.cMin - a.cMin).slice(0, 10);

    console.log(); // eslint-disable-line no-console
    console.log('minus'); // eslint-disable-line no-console
    for (let i = 0; i < d.length; i++) {
        // console.log(JSON.stringify(d[i], null, 4)); // eslint-disable-line no-console
        console.log(d[i]); // eslint-disable-line no-console
    }

    // function getIntersection(dataByDay: { [x: string]: any; }) {
    //     const uniqUid: any = {};

    //     Object.keys(dataByDay).forEach(k => dataByDay[k].forEach((u: any) => uniqUid[u.uid] = []));

    //     const intersectUids: any = {};
    //     Object.keys(uniqUid).forEach((k) => {
    //         Object.keys(dataByDay).forEach(j => {
    //             const daysWithUid = dataByDay[j].filter((p: { uid: string; }) => p.uid === k);
    //             if (daysWithUid.length) {
    //                 uniqUid[k].push(dataByDay[j].map((p: { uid: any; }) => p.uid));
    //             }
    //         });

    //         intersectUids[k] = [];

    //         uniqUid[k].forEach((u: string | any[], i: any) => {
    //             if (!intersectUids[k]) {
    //                 return;
    //             }

    //             if (!i) {
    //                 intersectUids[k] = u;
    //             } else {
    //                 intersectUids[k] = intersectUids[k].filter((value: any) => u.includes(value));
    //             }

    //             if (intersectUids[k].length <= 1) {
    //                 delete intersectUids[k];
    //             }
    //         });
    //     });

    //     // console.log(intersectUids); // eslint-disable-line no-console

    //     Object.keys(intersectUids).forEach(uid => {
    //         console.log('Движение вместе с', cachedUidTicker[uid]); // eslint-disable-line no-console

    //         intersectUids[uid].forEach((u: string) => {
    //             if (u !== uid) {
    //                 console.log(cachedUidTicker[u]); // eslint-disable-line no-console
    //             }
    //         });

    //         console.log(); // eslint-disable-line no-console
    //     });
    // }

    // console.log('plusByDay'); // eslint-disable-line no-console
    // getIntersection(plusByDay);

    // console.log('minusByDay'); // eslint-disable-line no-console
    // getIntersection(minusByDay);
})();
