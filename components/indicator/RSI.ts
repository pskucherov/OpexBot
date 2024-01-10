/* eslint-disable  @typescript-eslint/no-explicit-any */
import { Common } from '../../src/Common/TsCommon';
import { HistoricCandle } from 'tinkofftradingbotconnector/node_modules/tinkoff-sdk-grpc-js/dist/generated/marketdata';

// @ts-ignore
import NodeRSI from 'node-rsi';

export class RSI {
    static async calculate(candles: HistoricCandle[], period: number) {
        if (candles.length <= period) {
            return undefined;
        }

        let result = '0';

        const data = candles
            .filter(m => typeof m.close !== 'undefined')
            .map(m => Common.getPrice(m.close))
            .slice(-period - 1)
            .reverse();

        const rsi: NodeRSI = new NodeRSI(data, period);

        let rsiData: any = await (new Promise(resolve => {
            rsi.calculate((err: any, result: any) => {
                if (err) {
                    return err;
                }

                resolve(result);
            });
        }));

        rsiData = rsiData.filter((f: any) => Boolean(f.rsi));
        if (rsiData.length > 0) {
            result = parseFloat(rsiData[rsiData.length - 1].rsi).toFixed(2);
        }

        return parseFloat(result);
    }
}
