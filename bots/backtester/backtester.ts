import { Common } from '../../src/Common/Common';
import { Candles } from '../../components/investAPI/candles';
import { createSdk } from 'tinkoff-sdk-grpc-js';

// @ts-ignore
import { Backtest } from '../../src/Common/Backtest';
import { Instruments } from '../../components/investAPI/instruments';
import {RSI} from "../../components/indicator/RSI";

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

    const PERIOD = 20;
    const lots = 1;

    const candlesSdk = new Candles(sdk);
    const instrumentId = '0da66728-6c30-44c4-9264-df8fac2467ee'; // НОВАТЭК
    const { instrument } = (await instruments.getInstrumentById(instrumentId)) || {};
    const testerInterval = sdk.CandleInterval.CANDLE_INTERVAL_1_MIN;

    const minutesDailyCandlesArr = await candlesSdk.getCandles(
        instrumentId,
        testerInterval,
        '2023.10.01',
        '2023.12.16'
    );

    let backtestStep = 0;
    backtest.setBacktestState(backtestStep, testerInterval, instrumentId, undefined, {
        tickerInfo: instrument,
        type: 'instrument',
        instrumentId,
    });

    for (let candleIndex = PERIOD + 1; candleIndex < minutesDailyCandlesArr.length; candleIndex++) {
        backtestStep++;
        backtest.setBacktestState(backtestStep);

        // Расчёт RSI
        const currentRSI = await RSI.calculate(minutesDailyCandlesArr.slice(candleIndex - PERIOD - 1, candleIndex), PERIOD);
        const currentCandle = minutesDailyCandlesArr[candleIndex];
        const hasOpenedPosition = (backtest.getBacktestPositions()?.filter(position => !position.closed) || []).length > 0;

        if (currentRSI < 30) {
            if (!hasOpenedPosition) {
                backtest.backtestBuy(currentCandle.close, lots);
            }
        } else if (currentRSI > 80) {
            if (hasOpenedPosition) {
                backtest.backtestClosePosition(currentCandle.close, lots);
            }
        }
    }

    backtest.backtestClosePosition(minutesDailyCandlesArr[minutesDailyCandlesArr.length-1].close, lots);

    let result = 0;
    backtest.getBacktestPositions()?.forEach(position => {
        if (position.direction == 1) {
            result -= Common.getPrice(position.price);
        } else if (position.direction == 2) {
            result += Common.getPrice(position.price);
        }
    })

    console.log(result);
})();
