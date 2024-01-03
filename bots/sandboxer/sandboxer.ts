import { MoneyValue } from 'tinkoff-sdk-grpc-js/dist/generated/common';
import { Accounts } from './accounts';
import { createSdk } from 'tinkoff-sdk-grpc-js';
import { TOKEN } from '../../config';

import { debugEnd, debugStart } from '../../components/utils';
import { Candles } from '../../components/investAPI/candles';
import { Instruments } from '../../components/investAPI/instruments';

import fs from 'fs';
import path from 'path';

// import { Common } from '../../src/Common/Common';

// import { Robot } from './robot';
import { Log } from '../../components/log';
import { Robot } from './robot';

// import { MarketDataRequest, SubscriptionAction, SubscriptionInterval } from 'tinkoff-sdk-grpc-js/dist/generated/marketdata';

// import TelegramBot from 'node-telegram-bot-api';

// const TGBOTTOKEN = '';
// const TGUSERID = '';

// const keepCalling = true;

// setTimeout(function() {
//     keepCalling = false;
// }, 50000);

// const timer = (time: number) => new Promise(resolve => setTimeout(resolve, time));

const sdk = createSdk(TOKEN, 'sandboxer');

const instrumentCountForOneAccount = 3; // Если указать 1, то на один счёт будет один инструмент.

// Сумма пополнения демо счёта.
const payInAmount: MoneyValue = {
    units: 100000,
    nano: 0,
    currency: '',
};

// const tgbot = new TelegramBot(TGBOTTOKEN, { polling: true });
const instruments = new Instruments(sdk);

interface IAccountsIds {
    [key: string]: {
        accountId: string,
    };
}

const tradingSystems: {
    [key: string]: Robot;
} = {};

let instrumentsForTrade;
let accountsIds: IAccountsIds;

(async () => {
    const account = new Accounts(sdk);

    await account.closeAll();

    let accountNum = 0;
    let lastAccountId: string;

    try {
        const data = JSON.parse(fs.readFileSync(path.join(__dirname, './idsConfig.json')).toString());

        instrumentsForTrade = data.instrumentsForTrade;
        accountsIds = data.accountsIds;
    } catch (e) {
        const instrumentsForTrade = [
            '53b67587-96eb-4b41-8e0c-d2e3c0bdd234', // АФК система
            '1c69e020-f3b1-455c-affa-45f8b8049234', // AFLT
            '46ae47ee-f409-4776-bf20-43a040b9e7fb', // РусАгро
            '30817fea-20e6-4fee-ab1f-d20fc1a1bb72', // АЛРОСА
            'ebfda284-4291-4337-9dfb-f55610d0a907', // МКБ
            'fa6aae10-b8d5-48c8-bbfd-d320d925d096', // Северсталь
            'e2bd2eba-75de-4127-b39c-2f2dbe3866c3', // Эн+
            '88e130e8-5b68-4b05-b9ae-baf32f5a3f21', // ФСК Россети
            // 'aa183ebe-3dae-4f4b-b7a2-c03539375417', // Пятерочка
            // '962e2a95-02a9-4171-abd7-aa198dbe643a', // Газпром
            // '38be8280-96ef-45e9-b0ed-da76bc77fe7c', // Globaltrans Investment PLC
            // '509edd0c-129c-4ee2-934d-7f6246126da1', // Норильский никель
            // '62560f05-3fd0-4d65-88f0-a27f249cc6de', // РусГидро
            // '2dfbc1fd-b92a-436e-b011-928c79e805f2', // Интер РАО ЕЭС
            // '02cfdf61-6298-4c0f-a9ca-9cabc82afaf3', // ЛУКОЙЛ
            // '7132b1c9-ee26-4464-b5b5-1046264b61d9', // Магнитогорский металлургический комбинат
            // 'ca845f68-6c43-44bc-b584-330d2a1e5eb7', // Магнит
            // '5e1c2634-afc4-4e50-ad6d-f78fc14a539a', // Московская Биржа
            // 'cd8063ad-73ad-4b31-bd0d-93138d9e99a2', // МТС
            // '161eb0d0-aaac-4451-b374-f5d0eeb1b508', // НЛМК
            // '0da66728-6c30-44c4-9264-df8fac2467ee', // НОВАТЭК
            // '35fb8d6b-ed5f-45ca-b383-c4e3752c9a8a', // Ozon Holdings PLC
            // '9978b56f-782a-4a80-a4b1-a48cbecfd194', // ФосАгро
            // '03d5e771-fc10-438e-8892-85a40733612d', // ПИК
            // '10620843-28ce-44e8-80c2-f26ceb1bd3e1', // Полюс
            // '127361c2-32ec-448c-b3ec-602166f537ea', // Polymetal
            // 'de08affe-4fbd-454e-9fd1-46a81b23f870', // Positive Technologies
            // '120a928b-b2d6-45d7-a445-f6e49614ae6d', // QIWI
            // 'fd417230-19cf-4e7b-9623-f7c9ca18ec6b', // Роснефть
            // '02eda274-10c4-4815-8e02-a8ee7eaf485b', // Ростелеком
            // 'f866872b-8f68-4b6e-930f-749fe9aa79c0', // РУСАЛ
            // 'e6123145-9665-43e0-8413-cd61b8aa9b13', // Сбер Банк
            // '0d28c01b-f841-4e89-9c92-0ee23d12883a', // Селигдар
            // '7bedd86b-478d-4742-a28c-29d27f8dbc7d', // Сегежа
            // 'a797f14a-8513-4b84-b15e-a3b98dc4cc00', // Сургутнефтегаз - привилегированные акции
            // 'efdb54d3-2f92-44da-b7a3-8849e96039f6', // Татнефть - привилегированные акции
            // '6afa6f80-03a7-4d83-9cf0-c19d7d021f76', // TCS Group
            // '664921c5-b552-47a6-9ced-8735a3c6ca8a', // Юнипро
            // 'b71bd174-c72c-41b0-a66f-5f9073e0d1f5', // ВК
            // '8e2b0325-0292-4654-8a18-4f63ed3b0e09', // Банк ВТБ
            // '10e17a87-3bce-4a1f-9dfc-720396f98a3c', // Yandex
        ];

        // Создаём для каждого инструмента отдельный счёт в песочнице и пополняем на payInAmount.
        accountsIds = (await instrumentsForTrade.reduce(async (acc: Promise<IAccountsIds>, val) => {
            const data = await acc;

            try {
                if (!(accountNum % instrumentCountForOneAccount) || !lastAccountId) {
                    const { accountId } = await account.create();

                    await account.payIn({
                        accountId,
                        amount: payInAmount,
                    });

                    lastAccountId = accountId;
                }

                ++accountNum;

                return {
                    ...data,
                    [val]: {
                        accountId: lastAccountId,

                        // amount: payInAmount,
                    },
                };
            } catch (e) {
                console.log(e); // eslint-disable-line no-console

                return data;
            }
        }, Promise.resolve(<IAccountsIds>{})));

        try {
            fs.writeFileSync(path.join(__dirname, './idsConfig.json'),
                JSON.stringify({
                    instrumentsForTrade,
                    accountsIds,
                }),
            );
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    Object.keys(accountsIds).forEach(instrumentId => {
        const { accountId } = accountsIds[instrumentId];

        if (tradingSystems[accountId]) {
            return;
        }

        tradingSystems[accountId] = new Robot(accountId, 0, false, undefined, {
            enums: {
                OrderDirection: {
                    ...sdk.OrderDirection,
                },
            },
            brokerId: 'TINKOFF',
        }, sdk);
    });

    (async () => {
        // const found = await instruments.findInstrument('VTBR')
        // console.log('//', found[0].uid, found[0].name);

        for (const uid of instrumentsForTrade) {
            debugStart('Запуск testInstrument');
            await testInstrument(uid);
            debugEnd('Запуск testInstrument');
        }
    })();

    const candlesSdk = new Candles(sdk);
    const testerInterval = sdk.CandleInterval.CANDLE_INTERVAL_5_MIN;

    async function testInstrument(instrumentUID: string) {
        const { instrument } = await instruments.getInstrumentById(instrumentUID) || {};

        if (instrument) {
            debugStart('Получение свечей (candlesSdk.getCandles)');
            const from = new Date();

            from.setUTCDate(-70);

            const historicCandlesArr = await candlesSdk.getCandles(
                instrumentUID,
                testerInterval,
                from,
                new Date(),
            );

            debugEnd('Получение свечей (candlesSdk.getCandles)');

            const logSystem = new Log(instrument.ticker);

            console.log(historicCandlesArr, logSystem);
            console.log(tradingSystems);

            // const robot = new Robot(common, logSystem);

            // console.log(historicCandlesArr, robot);
            //     debugStart(`Обход всех свечей (makeStep), ${instrumentUID}, len ${historicCandlesArr.length}`);
            //     for (let candleIndex = 0; candleIndex < historicCandlesArr.length; candleIndex++) {
            //         backtestStep++;
            //         backtest.setBacktestState(backtestStep);

            //         await robot.initStep(historicCandlesArr[candleIndex]);
            //         robot.makeStep();
            //     }
            //     debugEnd(`Обход всех свечей (makeStep), ${instrumentUID}, len ${historicCandlesArr.length}`);

            //     backtest.backtestClosePosition(historicCandlesArr[historicCandlesArr.length - 1].close);

            //     const result = robot.printResult();

            //     if (process.env.DEBUG) {
            //         console.log('result', result); // eslint-disable-line no-console
            //         console.log(); // eslint-disable-line no-console
            //     }

            //     if (Number(process.env.DEBUG) === 2) {
            //         console.log(backtest.getBacktestPositions()); // eslint-disable-line no-console
            //     }

            //     backtest.stop();
        }
    }

    // console.log('accountsIds', accountsIds);
    // console.log(await account.list());

    //генератор подписки на свечи
    // async function* createSubscriptionCandleRequest(): AsyncIterable<DeepPartial<MarketDataRequest>> {
    //     while (keepCalling) {
    //         await timer(1000);
    //         yield MarketDataRequest.fromPartial({
    //             subscribeCandlesRequest: {
    //                 subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
    //                 instruments: instrumentsForTrade.map(i => {
    //                     return {
    //                         instrumentId: i,
    //                         interval: SubscriptionInterval.SUBSCRIPTION_INTERVAL_ONE_MINUTE,
    //                     };
    //                 }),
    //                 waitingClose: true,
    //             },
    //         });
    //     }
    // }

    // const response = sdk.marketDataStream.marketDataStream(createSubscriptionCandleRequest());

    // for await (const num of response) {
    //     const { candle } = num || {};

    //     if (candle) {
    //         console.log(JSON.stringify(num, null, 4)); // eslint-disable-line no-console
    //     }
    // }
})();
