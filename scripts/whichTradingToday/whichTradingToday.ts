// @ts-nocheck
/* eslint @typescript-eslint/no-explicit-any: 0 */

import { createSdk } from 'tinkoff-sdk-grpc-js';
import { TOKEN } from '../../config';

import { Instruments } from '../../components/investAPI/instruments';
import { logger } from '../../src/utils';

import { SecurityTradingStatus } from 'tinkoff-sdk-grpc-js/dist/generated/common';

const sdk = createSdk(TOKEN, 'backtester', logger);
const instruments = new Instruments(sdk);

const cachedUidTicker: any = {};

(async () => {
    try {
        const allBaseShares = ((await instruments.getAllShares()).filter(s => s.currency === 'rub'));

        for (let i = 0; i < allBaseShares.length; i++) {
            const { uid, ticker, name } = allBaseShares[i];

            cachedUidTicker[uid] = `${name} (${ticker})`;
        }

        const { tradingStatuses } = await sdk.marketData.getTradingStatuses({
            instrumentId: allBaseShares.map(s => s.uid),
        }) || {};

        const tData = tradingStatuses.filter(
            t => [
                SecurityTradingStatus.SECURITY_TRADING_STATUS_NORMAL_TRADING,
                SecurityTradingStatus.SECURITY_TRADING_STATUS_DEALER_NORMAL_TRADING,
            ].includes(t.tradingStatus),
        );

        tData.forEach((t, i) => console.log(`${i + 1}.`, cachedUidTicker[t.instrumentUid])); // eslint-disable-line no-console
    } catch (e) {
        console.log(e); // eslint-disable-line no-console
    }
})();
