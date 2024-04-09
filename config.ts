// https://articles.opexflow.com/trading-training/kak-poluchit-token-dlya-tinkoff-investicii.htm
// Для игнорирования файла в git (чтобы случайно не закоммитить):

import { createSdk } from 'tinkoff-sdk-grpc-js';

// git update-index --assume-unchanged config.ts
const TOKEN = '';

if (!TOKEN) {
    throw 'Заполните токен в файле config.ts';
}

const ACCOUNTID = '';

const SDK = createSdk(TOKEN, 'opexbot');

export {
    TOKEN,
    ACCOUNTID,
    SDK,
};
