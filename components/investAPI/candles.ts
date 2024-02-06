import { Common } from './common';
import { Cache } from './../cache';
import { Time } from '../time';
import { Candle, HistoricCandle } from 'tinkoff-sdk-grpc-js/dist/generated/marketdata';

interface IProps {
    instrumentId: string;
    interval: number;
    day?: Date,
    from?: Date,
    to?: Date,
    limit?: number;
}

export class Candles extends Common {
    cache: Cache = new Cache('candles');

    async getCandles(props: IProps) {
        const { from, to, instrumentId, interval } = props;

        try {
            const { candles } = await this.sdk.marketData.getCandles({
                instrumentId,
                interval,
                from,
                to,
            });

            return candles;
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }

        return [];
    }

    async getCandlesDayByDay(instrumentId: string, interval: number, from: string | Date, to: string | Date) {
        try {
            const toDate = to instanceof Date ? to : new Date(to);
            const currentDay = from instanceof Date ? from : new Date(from);
            const result: HistoricCandle[] = [];

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
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }

        return [];
    }

    async getCandlesDaily(props: IProps) {
        try {
            const {
                instrumentId,
                interval,
                day,
            } = props;

            if (!day) {
                throw 'Не указана дата';
            }

            let {
                from,
                to,
            } = props;

            const cacheKey = `${instrumentId}/${interval}/${Time.formatDate(day)}`;
            const cachedData = this.cache.get(cacheKey);

            if (cachedData) {
                return cachedData.map((candle: Candle | HistoricCandle) => {
                    candle.time = candle.time && new Date(candle.time);

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
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }

        return [];
    }
}
