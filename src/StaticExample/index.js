try {
    const { Backtest } = require('../Common/Backtest');

    const path = require('path');
    const name = __dirname.split(path.sep).pop();

    /**
     * Заготовка торгового робота.
     */
    class Bot extends Backtest {
        static async order(sdk, props) {
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

                const postOrder = sdk?.orders?.postOrder;
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

                return await postOrder(data);
            } catch (e) {
                console.log('order', e); // eslint-disable-line no-console
            }
        }

        static async closeAllByBestPrice(sdk, props) {
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

                positions?.filter(p => Boolean(p))
                    .forEach(async position => {
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
                    });
            } catch (e) {
                console.log('closeAllByBestPrice', e); // eslint-disable-line no-console
            }
        }
    }

    module.exports[name] = Bot;
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
