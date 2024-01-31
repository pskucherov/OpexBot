// @ts-nocheck
/* eslint @typescript-eslint/no-explicit-any: 0 */
/* eslint @typescript-eslint/no-unused-vars: 0 */
/* eslint @typescript-eslint/ban-types: 0 */
/* eslint max-len: 0 */
/* eslint sonarjs/no-duplicate-string: 0 */

import { createSdk } from 'tinkoff-sdk-grpc-js';
import { OrderType } from 'tinkoff-sdk-grpc-js/dist/generated/orders';

try {
    const { Backtest } = require('../Common/Backtest');

    const path = require('path');
    const name = __dirname.split(path.sep).pop();

    /**
     * Заготовка торгового робота.
     */
    class Bot extends Backtest {
        static async order(sdk: ReturnType<typeof createSdk>,
            props: {
                accountId: string;
                instrumentId: string;
                quantity: number;
                price?: string;
                orderType?: OrderType;
            },
        ) {
            const {
                accountId,
                price,
                instrumentId,
                quantity,
                orderType,
            } = props;

            try {
                if (!sdk?.orders?.postOrder || !accountId || !quantity) {
                    return;
                }

                const orderId = this.genOrderId();
                const direction = quantity < 0 ?
                    sdk?.OrderDirection.ORDER_DIRECTION_SELL :
                    sdk?.OrderDirection.ORDER_DIRECTION_BUY;

                const data = {
                    quantity: Math.abs(quantity),
                    accountId,
                    direction,
                    orderId,
                    instrumentId,
                    orderType: orderType || sdk.OrderType.ORDER_TYPE_BESTPRICE,
                };

                if (price) {
                    data[price] = price;
                }

                return await sdk?.orders?.postOrder(data);
            } catch (e) {
                console.log('order', e); // eslint-disable-line no-console
            }
        }

        static async closeAllByBestPrice(sdk: ReturnType<typeof createSdk>, props: { accountId: string; allInstrumentsWithIdKeys?: any; }) {
            try {
                if (!sdk?.operations?.getPositions) {
                    return;
                }

                const {
                    accountId,
                    allInstrumentsWithIdKeys,
                } = props;

                const p = await sdk?.operations?.getPositions({
                    accountId,
                });

                const positions = ([].concat(p.securities, p.futures, p.options, p.bonds));

                for (let i = 0; i < positions.length; i++) {
                    const position = positions[i];

                    if (!position) {
                        continue;
                    }

                    try {
                        const id = position.instrumentUid;

                        const info = allInstrumentsWithIdKeys?.[id];

                        if (info?.lot && id && props.accountId) {
                            await this.order(
                                sdk,
                                {
                                    accountId: props.accountId,
                                    instrumentId: id,
                                    quantity: -1 * parseInt(position.balance / info?.lot, 10),
                                },
                            );
                        }
                    } catch (e) {
                        console.log('closeAllByBestPrice', e); // eslint-disable-line no-console
                    }
                }
            } catch (e) {
                console.log('closeAllByBestPrice', e); // eslint-disable-line no-console
            }
        }
    }

    if (name) {
        module.exports[name] = Bot;
    }
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
