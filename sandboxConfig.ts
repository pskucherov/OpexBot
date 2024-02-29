// https://articles.opexflow.com/trading-training/kak-poluchit-SANDBOXtoken-dlya-tinkoff-investicii.htm
// Для игнорирования файла в git (чтобы случайно не закоммитить):
import { MoneyValue } from 'tinkoff-sdk-grpc-js/dist/generated/common';
import { logger } from './src/utils';
import { createSdk } from 'tinkoff-sdk-grpc-js';
import { Accounts } from './bots/sandboxer/accounts';

// git update-index --assume-unchanged config.ts
const SANDBOXTOKEN = '';

if (!SANDBOXTOKEN) {
    throw 'Заполните токен в файле config.ts';
}

const sdk = createSdk(SANDBOXTOKEN, 'sandboxer', logger, {
    isSandbox: true,
});

// Сумма пополнения демо счёта.
const payInAmount: MoneyValue = {
    units: 100000,
    nano: 0,
    currency: '',
};

const account = new Accounts(sdk);
const getSandboxAccoutId = async (resetAccount?: boolean) => {
    const list = await account.list();

    const accountId = list?.accounts?.[0]?.id;

    if (!accountId || resetAccount) {
        await account.resetAllAccounts();

        await account.payIn({
            amount: payInAmount,
            accountId,
        });
    }

    console.log('Подключён sandbox счёт.'); // eslint-disable-line no-console
    console.log((await account.getPortfolio({ // eslint-disable-line no-console
        accountId,
    })).totalAmountPortfolio);

    return accountId;
};

const SANDBOXSDK = sdk;

export {
    SANDBOXSDK,
    SANDBOXTOKEN,
    getSandboxAccoutId,
};
