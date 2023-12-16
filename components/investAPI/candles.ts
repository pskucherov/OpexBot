import { Common } from "./common";
import {HistoricCandle} from "tinkoff-sdk-grpc-js/src/generated/marketdata";

interface IProps {
    instrumentId: string;
    interval: number;
    day?: Date,
    from?: Date,
    to?: Date,
    limit?: number;
}

export class Candles extends Common
{

    async getCandles(instrumentId: string, interval: number, from: string, to: string) {
        const toDate = new Date(to);
        let currentDay = new Date(from);
        let result: HistoricCandle[] = [];

        while (currentDay.getTime() <= toDate.getTime()) {
            const { candles } = await this.getCandlesDaily({
                interval: interval,
                day: currentDay,
                instrumentId,
            });
            if (candles?.length) {
                result.push(...candles);
            }
            currentDay.setDate(currentDay.getDate() + 1);
        }
        return result;
    }

    async getCandlesDaily(props: IProps) {
        const {
            instrumentId,
            interval,
            day,
        } = props;

        let {
            from, 
            to,
        } = props;

        if (day) {
            from = new Date(day);
            from.setHours(0, 0, 0, 0);

            to = new Date(day);
            to.setHours(23, 59, 59, 999);
        }

        return await this.sdk.marketData.getCandles({
            instrumentId,
            interval: interval,
            from,
            to,
        })
    }
}