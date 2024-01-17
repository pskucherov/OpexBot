import { createSdk } from 'tinkoff-sdk-grpc-js';

export class Common {
    sdk: ReturnType<typeof createSdk>;

    constructor(sdk: ReturnType<typeof createSdk>) {
        this.sdk = sdk;
    }
}
