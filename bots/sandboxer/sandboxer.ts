import { Accounts } from './accounts';
import { createSdk } from 'tinkoff-sdk-grpc-js';

// import TelegramBot from 'node-telegram-bot-api';

const TINKOFFTOKEN = '';

// const TGBOTTOKEN = '';
// const TGUSERID = '';

const sdk = createSdk(TINKOFFTOKEN, 'sandboxer');

// const tgbot = new TelegramBot(TGBOTTOKEN, { polling: true });

(async () => {
    const account = new Accounts(sdk);

    console.log(await account.closeAll()); // eslint-disable-line no-console
    console.log(await account.list()); // eslint-disable-line no-console

    console.log(await sdk.marketData.getLastPrices({ // eslint-disable-line no-console
        instrumentId: ['e6123145-9665-43e0-8413-cd61b8aa9b13', '0da66728-6c30-44c4-9264-df8fac2467ee'],
    }));
})();
