import { createSdk } from 'tinkofftradingbotconnector/node_modules/tinkoff-sdk-grpc-js';

export class Common {
    sdk: ReturnType<typeof createSdk>;

    constructor(sdk: ReturnType<typeof createSdk>) {
        this.sdk = sdk;
    }
}
