import { Candles } from '../../components/investAPI/candles';
import { createSdk } from 'tinkoff-sdk-grpc-js';

// @ts-ignore
import { Backtest } from '../../src/Common/Backtest';
import { Instruments } from '../../components/investAPI/instruments';
import {Robot} from "./robot";

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
const instrumentsForTrade = [
    '53b67587-96eb-4b41-8e0c-d2e3c0bdd234', // АФК система
    '0da66728-6c30-44c4-9264-df8fac2467ee', // НОВАТЭК
    '10e17a87-3bce-4a1f-9dfc-720396f98a3c', // Yandex
];

(async () => {

    // const found = await instruments.findInstrument('AFKS');
    // console.log(found.instruments.filter(instrument => instrument.first1minCandleDate && instrument.apiTradeAvailableFlag));

    // instrumentsForTrade.forEach(instrumentUID => {
    //      instruments.getInstrumentById(instrumentUID).then(res => console.log(res));
    // })

    const candlesSdk = new Candles(sdk);
    const instrumentId = instrumentsForTrade[2];
    const { instrument } = (await instruments.getInstrumentById(instrumentId)) || {};
    const testerInterval = sdk.CandleInterval.CANDLE_INTERVAL_5_MIN;

    const historicCandlesArr = await candlesSdk.getCandles(
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

    const robot = new Robot(backtest);

    for (let candleIndex = 0; candleIndex < historicCandlesArr.length; candleIndex++) {
        backtestStep++;
        backtest.setBacktestState(backtestStep);

        await robot.initStep(historicCandlesArr[candleIndex]);
        robot.makeStep();
    }

    backtest.backtestClosePosition(historicCandlesArr[historicCandlesArr.length-1].close);

    robot.printResult();
})();