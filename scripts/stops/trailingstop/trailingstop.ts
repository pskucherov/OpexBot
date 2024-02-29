// import { ACCOUNTID as accountId, TOKEN } from '../../../config';
import { OrderType } from 'tinkoff-sdk-grpc-js/dist/generated/orders';
import { SANDBOXSDK, getSandboxAccoutId } from '../../../sandboxConfig';
import { v4 as uuidv4 } from 'uuid';

const sdk = SANDBOXSDK;

const instrumentsForTrade = [
    '53b67587-96eb-4b41-8e0c-d2e3c0bdd234', // АФК система
    // '1c69e020-f3b1-455c-affa-45f8b8049234', // AFLT
    // '46ae47ee-f409-4776-bf20-43a040b9e7fb', // РусАгро
    // '30817fea-20e6-4fee-ab1f-d20fc1a1bb72', // АЛРОСА
    // 'ebfda284-4291-4337-9dfb-f55610d0a907', // МКБ
    // 'fa6aae10-b8d5-48c8-bbfd-d320d925d096', // Северсталь
    // 'e2bd2eba-75de-4127-b39c-2f2dbe3866c3', // Эн+
    // '88e130e8-5b68-4b05-b9ae-baf32f5a3f21', // ФСК Россети
];

(async () => { // eslint-disable-line

    const accountId = await getSandboxAccoutId();

    try {
        const { securities } = await sdk.operations.getPositions({
            accountId,
        }) || {};

        const { positions } = await sdk.operations.getPortfolio({
            accountId,
        }) || {};

        console.log('securities', securities); // eslint-disable-line no-console
        console.log('positions', positions); // eslint-disable-line no-console

        0 && instrumentsForTrade.forEach(async instrumentId => {
            const postOrder = await sdk.orders.postOrder({
                quantity: 1,
                direction: 1,
                orderType: OrderType.ORDER_TYPE_BESTPRICE,
                orderId: uuidv4(),
                instrumentId,
                accountId,
            });

            console.log(postOrder); // eslint-disable-line no-console
        });

        // const gen = sdk.operationsStream.positionsStream({
        //     accounts: [accountId],
        // });

        // for await (const data of gen) {
        //     if (data.position) {
        //         console.log('data.position', data.position); // eslint-disable-line no-console
        //     }
        // }

        const gen = sdk.operationsStream.portfolioStream({
            accounts: [accountId],
        });

        for await (const data of gen) {
            if (data.portfolio) {
                console.log('data.portfolio', data.portfolio); // eslint-disable-line no-console
            }
        }
    } catch (e) {
        console.log(e); // eslint-disable-line no-console
    }
})();

setInterval(() => { }, 5000);
