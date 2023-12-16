import { Common } from '../../src/Common/Common';
import { Candles } from '../../components/investAPI/candles';
import { createSdk } from 'tinkoff-sdk-grpc-js';

// @ts-ignore
import RSI from 'node-rsi';
import { Backtest } from '../../src/Common/Backtest';
import { Instruments } from '../../components/investAPI/instruments';
import { HistoricCandle } from 'tinkoff-sdk-grpc-js/dist/generated/marketdata';

// https://www.youtube.com/shorts/hi4O4CTpd5Y
const TINKOFFTOKEN = '';

const logger = (a?: any, b?: any, c?: any) => console.log(a || '', b || '', c || '');

const sdk = createSdk(TINKOFFTOKEN, 'backtester', logger);
const backtest = new Backtest(0, 0, true, undefined, {
    enums: {
        OrderDirection: {
            ...sdk.OrderDirection,
        }
    },
    brokerId: 'TINKOFF',
});

const instruments = new Instruments(sdk);

(async () => {

    const candlesSdk = new Candles(sdk);
    const minutesDailyCandlesArr: HistoricCandle[] = [];
    const instrumentId = '0da66728-6c30-44c4-9264-df8fac2467ee'; // НОВАТЭК
    const { instrument } = (await instruments.getInstrumentById(instrumentId)) || {};
    let testerInterval = sdk.CandleInterval.CANDLE_INTERVAL_1_MIN;

    // Получить минутные свечи за две недели.
    for (let day = 1; day <= 14; day++) {
        const { candles } = await candlesSdk.getMinutesDaily({
            day: new Date(`2023.12.${day}`),
            instrumentId,
        });

        if (candles?.length) {
            minutesDailyCandlesArr.push(...candles);
        }
    }

    // Расчёт RSI
    const PERIOD = 200;
    const data = minutesDailyCandlesArr.map(m => Common.getPrice(m.close));
    const rsi = new RSI(data, PERIOD);
    let rsiData: any = await (new Promise((resolve) => {
        rsi.calculate((err: any, result: any) => {
            if (err) {
                return err;
            }

            resolve(result);
        });
    }));

    const r: any = {};

    rsiData = rsiData.filter((f: any) => !!f.rsi);

    // Сводка по рассчитанным rsi
    rsiData.forEach((i: { rsi: string; }) => {
        // if (i.rsi) {
        const data = parseInt(i.rsi);

        if (r[data]) {
            r[data]++;
        } else {
            r[data] = 1;
        }
        // }
    });

    console.log('RSI STAT');
    console.log(r);

    // console.log(rsiData[0]);

    for (let i = 0; i < rsiData.length; i++) {
        const data = rsiData[i];

        // if (!data.rsi) {
        //     continue;
        // }

        if (!i) {
            backtest.setBacktestState(0, testerInterval, instrumentId, undefined, {
                tickerInfo: instrument,
                type: 'instrument',
                instrumentId,
            });
        } else {
            backtest.setBacktestState(i);

            if (data.rsi >= 55) {
                // Нужно доделать подсчёт RSI, чтобы возвращал данные исходных свечей.
                // Тогда цена будет браться из исходных units и nano.
                const p = data.value.toFixed(9).split('.');
                const price = { units: Number(p[0]), nano: Number(p[1]) };

                const lots = 1;
                backtest.backtestBuy(price, lots);
            } else if (data.rsi <= 45) {
                // Нужно доделать подсчёт RSI, чтобы возвращал данные исходных свечей.
                // Тогда цена будет браться из исходных units и nano.
                const p = data.value.toFixed(9).split('.');
                const price = { units: Number(p[0]), nano: Number(p[1]) };
                const lots = 1;

                backtest.backtestClosePosition(price, lots);
            }
        }

    }

    console.log(JSON.stringify(backtest, null, 4));

    const profit = backtest.backtestPositions?.reduce((acc, val) => {
        if (!val.closed || !val.expectedYield) {
            return acc;
        }

        acc.units += val.expectedYield.units;
        acc.nano += val.expectedYield.nano;

        return acc;
    }, {
        units: 0,
        nano: 0,
    });

    console.log('PROFIT:', Common.getPrice(profit));
})();
