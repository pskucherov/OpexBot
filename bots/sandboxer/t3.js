import { createSdk } from 'tinkoff-sdk-grpc-js';
import { OrderType } from 'tinkoff-sdk-grpc-js/dist/generated/orders';
import { v4 as uuidv4 } from 'uuid';

!(async function example() {
    const { ordersStream, operationsStream, orders } = createSdk(
        '',
        '', () => { }, {
            isSandbox: true,
        });

    const subscribes = {
        orders: ordersStream.tradesStream,
        positions: operationsStream.positionsStream,
    };

    const accountId = '6dff47e0-343e-4e61-a535-1d00a78227d6';

    ['orders', 'positions'].forEach(name => {
        if (subscribes[name]) {
            setImmediate(async () => {
                try {
                    const gen = subscribes[name]({
                        accounts: [accountId],
                    });

                    for await (const data of gen) {
                        if (data.orderTrades) {
                            console.log('data.orderTrades', data.orderTrades); // eslint-disable-line no-console
                        } else if (data.position) {
                            console.log('data.position', data.position); // eslint-disable-line no-console
                        }

                        // if (!this.inProgress) {
                        //     gen = null;
                        //     break;
                        // }
                    }
                } catch (e) {
                    console.log(e); // eslint-disable-line no-console
                }
            });
        }
    });

    setTimeout(() => {
        orders.postOrder({
            quantity: 1,
            direction: 1,
            accountId,
            orderType: OrderType.ORDER_TYPE_BESTPRICE,
            orderId: uuidv4(),
            instrumentId: 'e6123145-9665-43e0-8413-cd61b8aa9b13',

            // timeInForce: TimeInForceType,
            // priceType: PriceType.,
        });
    }, 5000);
})();
