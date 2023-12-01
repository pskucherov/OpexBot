const { throws } = require('assert');
const { parse } = require('path');

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

                return await postOrder(
                    {
                        quantity: Math.abs(quantity),
                        accountId,
                        price,
                        direction,
                        orderId,
                        instrumentId,
                        orderType: orderType || sdk.OrderType.ORDER_TYPE_BESTPRICE,
                    },
                );
            } catch (e) {
                console.log('order', e); // eslint-disable-line no-console
            }
        }
    }

    module.exports[name] = Bot;
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
