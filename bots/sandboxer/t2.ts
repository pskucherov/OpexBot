import { createSdk } from 'tinkoff-sdk-grpc-js';

import fs from 'fs';
import path from 'path';

!(async function example() {
    const { sandbox } = createSdk('');

    try {
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, './idsConfig.json')).toString());

        const instrumentsForTrade = data.instrumentsForTrade;
        const accountsIds = data.accountsIds;

        console.log(instrumentsForTrade, accountsIds); // eslint-disable-line no-console
    } catch (e) {
        console.log(e); // eslint-disable-line
    }

    const s = await sandbox.getSandboxAccounts({});

    console.log(s); // eslint-disable-line no-console

    const w = await sandbox.getSandboxOrders({ accountId: '6dff47e0-343e-4e61-a535-1d00a78227d6' });

    console.log(w); // eslint-disable-line no-console
})();
