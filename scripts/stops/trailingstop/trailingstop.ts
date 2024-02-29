// import { ACCOUNTID as accountId, TOKEN } from '../../../config';
// import { OrderType } from 'tinkoff-sdk-grpc-js/dist/generated/orders';
import { Common } from '../../../src/Common/TsCommon';
import { SDK, ACCOUNTID } from '../../../config';

// import { v4 as uuidv4 } from 'uuid';
import { StopOrderDirection, StopOrderExpirationType, StopOrderStatusOption, StopOrderType } from 'tinkoff-sdk-grpc-js/dist/generated/stoporders';

// import { SANDBOXSDK } from 'sandboxConfig';

const sdk = SDK; // SANDBOXSDK;

(async () => { // eslint-disable-line

    const accountId = ACCOUNTID; // await getSandboxAccoutId();

    try {
        const { securities } = await sdk.operations.getPositions({
            accountId,
        }) || {};

        const { positions } = await sdk.operations.getPortfolio({
            accountId,
        }) || {};

        console.log('securities', securities); // eslint-disable-line no-console
        console.log('positions', positions); // eslint-disable-line no-console

        const { stopOrders } = await sdk.stopOrders.getStopOrders({
            accountId,
            status: StopOrderStatusOption.STOP_ORDER_STATUS_ACTIVE,
        });

        console.log(stopOrders); // eslint-disable-line no-console

        if (!stopOrders?.length) {
            console.log('Выставляем стопы'); // eslint-disable-line no-console
            for (let j = 0; j < positions.length; j++) {
                const { instrumentType,
                    quantity,
                    averagePositionPrice,
                    instrumentUid,
                } = positions[j];

                if (instrumentType !== 'share' || !averagePositionPrice?.units) {
                    continue;
                }

                const stop = await sdk.stopOrders.postStopOrder({
                    quantity: Common.getPrice(quantity),
                    price: {
                        units: averagePositionPrice?.units + 8,
                        nano: 0, // averagePositionPrice?.nano
                    },
                    stopPrice: {
                        units: averagePositionPrice?.units + 8,
                        nano: averagePositionPrice?.nano,
                    },

                    // averagePositionPrice,
                    direction: StopOrderDirection.STOP_ORDER_DIRECTION_SELL,
                    expirationType: StopOrderExpirationType.STOP_ORDER_EXPIRATION_TYPE_GOOD_TILL_CANCEL,
                    stopOrderType: StopOrderType.STOP_ORDER_TYPE_STOP_LIMIT,

                    // orderId: uuidv4(),
                    instrumentId: instrumentUid,
                    accountId,
                });

                console.log(stop); // eslint-disable-line no-console
            }
        } else {
            console.log('Убираем стопы'); // eslint-disable-line no-console

            // console.log(stopOrders);
            for (let j = 0; j < stopOrders.length; j++) {
                console.log(stopOrders[j]); // eslint-disable-line no-console

                const { stopOrderId } = stopOrders[j];

                const sOrder = await sdk.stopOrders.cancelStopOrder({
                    accountId,
                    stopOrderId,
                });

                console.log(sOrder); // eslint-disable-line no-console
            }
        }

        // stopOrders = await sdk.stopOrders.getStopOrders({
        //     accountId,
        //     status: StopOrderStatusOption.STOP_ORDER_STATUS_ACTIVE,
        // });

        // console.log(stopOrders);

        // 0 && instrumentsForTrade.forEach(async instrumentId => {
        //     const postOrder = await sdk.orders.postOrder({
        //         quantity: 1,
        //         direction: 1,
        //         orderType: OrderType.ORDER_TYPE_BESTPRICE,
        //         orderId: uuidv4(),
        //         instrumentId,
        //         accountId,
        //     });

        //     console.log(postOrder); // eslint-disable-line no-console
        // });

        // const gen = sdk.operationsStream.positionsStream({
        //     accounts: [accountId],
        // });

        // for await (const data of gen) {
        //     if (data.position) {
        //         console.log('data.position', data.position); // eslint-disable-line no-console
        //     }
        // }

        // const gen = sdk.operationsStream.portfolioStream({
        //     accounts: [accountId],
        // });

        // for await (const data of gen) {
        //     if (data.portfolio) {
        //         console.log('data.portfolio', data.portfolio); // eslint-disable-line no-console
        //     }
        // }
    } catch (e) {
        console.log(e); // eslint-disable-line no-console
    }
})();

setInterval(() => { }, 5000);
