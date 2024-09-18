// import { ACCOUNTID as accountId, TOKEN } from '../../../config';
// import { OrderType } from 'tinkoff-sdk-grpc-js/dist/generated/orders';
import { createSdk } from 'tinkoff-sdk-grpc-js';

// import { Common } from '../../src/Common/TsCommon';

const TOKEN = '';
const SDK = createSdk(TOKEN, 'opexbot');

// import { SANDBOXSDK } from 'sandboxConfig';

const sdk = SDK; // SANDBOXSDK;

(async () => { // eslint-disable-line

    try {
        const { accounts } = await sdk.users.getAccounts({});

        const o = await sdk.operations.getOperationsByCursor({
            accountId: accounts[0].id,
        });

        console.log(o.items.filter(f => Boolean(f.cancelReason))); // eslint-disable-line no-console
    } catch (e) {
        console.log(e); // eslint-disable-line no-console
    }
})();

setInterval(() => { }, 5000);
