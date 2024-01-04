import { createSdk } from 'tinkoff-sdk-grpc-js';
import { Backtest } from './TsBacktest';
import { candlesSubscribe, lastPriceSubscribe,
    orderBookSubscribe,
} from '../../components/investAPI/subscribeTemplates';

export class Sandbox extends Backtest {
    constructor(accountId: string, _adviser?: boolean,
        backtest?: boolean, callbacks?: any, // eslint-disable-line
        options?: any, sdk?: ReturnType<typeof createSdk>) { // eslint-disable-line
        if (!sdk) {
            throw 'Передайте sdk в песочницу.';
        }

        const cb = {
            ...(callbacks || {}),

            subscribes: {
                candle: candlesSubscribe.bind(null, sdk),
                lastPrice: lastPriceSubscribe.bind(null, sdk),
                orderbook: orderBookSubscribe.bind(null, sdk),
                orders: sdk.ordersStream.tradesStream,
                positions: sdk.operationsStream.positionsStream,
            },
        };

        super(accountId, _adviser, backtest, cb, options, sdk);
    }
}
