import { Common } from "./common";

interface IProps {
    instrumentId: string;
    day?: Date,
    from?: Date,
    to?: Date,
    limit?: number;
}

export class Candles extends Common {

    async getMinutesDaily(props: IProps) {
        const {
            instrumentId,
            day,
        } = props;

        let {
            from, 
            to,
        } = props;

        if (day) {
            from = new Date(day);
            from.setUTCHours(0, 0, 0, 0);

            to = new Date(day);
            to.setUTCHours(23, 59, 59, 999);
        }

        return await this.sdk.marketData.getCandles({
            instrumentId,
            interval: this.sdk.CandleInterval.CANDLE_INTERVAL_1_MIN,
            from,
            to,
        })
    }
}