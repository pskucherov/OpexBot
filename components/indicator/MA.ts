import { Common } from '../../src/Common/Common';
import { HistoricCandle } from 'tinkoff-sdk-grpc-js/src/generated/marketdata';

// @ts-ignore
import { ma, dma, ema, sma, wma } from 'moving-averages';

type maType = 'MA'|'DMA'|'EMA'|'SMA'|'WMA';

export class MA {
    static async calculate(candles: HistoricCandle[], period: number, type: maType) {
        if (candles.length <= period) {
            return undefined;
        }

        let result = 0;

        const data = candles.map(m => Common.getPrice(m.close)).slice(-period - 1);

        switch (type) {
            case 'MA':
                result = ma(data);
                break;

            case 'DMA':
                result = dma(data);
                break;

            case 'EMA':
                result = ema(data);
                break;

            case 'SMA':
                result = sma(data);
                break;

            case 'WMA':
                result = wma(data);
                break;
        }

        return parseFloat(result.toFixed(2));
    }
}
