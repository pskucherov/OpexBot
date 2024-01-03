import { createSdk } from 'tinkoff-sdk-grpc-js';
import { Backtest } from './Backtest';

export class Sandbox extends Backtest {
    constructor(accountId: string, _adviser?: boolean,
        backtest?: boolean, callbacks?: any,
        options?: any, sdk?: ReturnType<typeof createSdk>) {
        super(accountId, _adviser, backtest, callbacks, options, sdk);
    }
}
