import { Common } from "./common";
import { Cache } from "./../cache";
import {Time} from "../time";

interface IProps {
    instrumentId: string;
    interval: number;
    day: Date,
    from?: Date,
    to?: Date,
    limit?: number;
}

export interface Candle {
    open: Price,
    high: Price,
    low: Price,
    close: Price,
    volume: number,
    time: Date,
    isComplete: boolean
}

interface Price {
    units: number,
    nano: number
}

export class Candles extends Common
{
    cache: Cache = new Cache('candles');

    async getCandles(instrumentId: string, interval: number, from: string, to: string) {
        const toDate = new Date(to);
        let currentDay = new Date(from);
        let result: Candle[] = [];

        while (currentDay.getTime() <= toDate.getTime()) {
            const candles = await this.getCandlesDaily({
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

        const cacheKey = `${instrumentId}/${interval}/${Time.formatDate(day)}`;
        const cachedData = this.cache.get(cacheKey);

        if (cachedData) {
            return cachedData.map((candle: Candle) => {
                candle.time = new Date(candle.time)
                return candle;
            });
        }

        if (day) {
            from = new Date(day);
            from.setHours(0, 0, 0, 0);

            to = new Date(day);
            to.setHours(23, 59, 59, 999);
        }

        const { candles } = await this.sdk.marketData.getCandles({
            instrumentId,
            interval: interval,
            from,
            to,
        });

        await Time.delay(200);

        if (candles.length > 0) {
            this.cache.set(cacheKey, candles);
        }

        return candles;
    }
}