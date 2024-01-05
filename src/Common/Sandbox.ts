import { createSdk } from 'tinkoff-sdk-grpc-js';
import { Backtest } from './TsBacktest';
import {
    candlesSubscribe, lastPriceSubscribe,
    orderBookSubscribe,
} from '../../components/investAPI/subscribeTemplates';
import { OperationState } from 'tinkoff-sdk-grpc-js/dist/generated/operations';
import { Quotation } from 'tinkoff-sdk-grpc-js/dist/generated/common';
import { OrderDirection, OrderType } from 'tinkoff-sdk-grpc-js/dist/generated/orders';

export class Sandbox extends Backtest {
    constructor(accountId: string, _adviser?: boolean,
        backtest?: boolean, callbacks?: any, // eslint-disable-line
        options?: any, sdk?: ReturnType<typeof createSdk>) { // eslint-disable-line
        if (!sdk) {
            throw 'Передайте sdk в песочницу.';
        }

        const cb = {
            ...(callbacks || {}),

            subscribes: {
                candle: candlesSubscribe.bind(null, sdk),
                lastPrice: lastPriceSubscribe.bind(null, sdk),
                orderbook: orderBookSubscribe.bind(null, sdk),
                orders: sdk.ordersStream.tradesStream,
                positions: sdk.operationsStream.positionsStream,
            },

            getOrders: async (accountId: string) => {
                return await sdk.sandbox.getSandboxOrders({ accountId });
            },

            getPositions: async (accountId: string) => {
                return await sdk.sandbox.getSandboxPositions({ accountId });
            },

            getPortfolio: async (accountId: string) => {
                return await sdk.sandbox.getSandboxPortfolio({ accountId });
            },

            getOperations: async (accountId: string, instrumentId?: string, state?: OperationState, date?: Date) => {
                let from;
                let to;

                if (date) {
                    from = new Date(date);
                    from.setUTCHours(0, 0, 0, 0);

                    to = new Date(date);
                    to.setUTCHours(0, 0, 0, 0);
                }

                return await sdk.sandbox.getSandboxOperations({
                    accountId,
                    from,
                    to,
                    state,
                    figi: instrumentId, // figi deprecated
                });
            },

            getOrderState: async (accountId: string, orderId: string) => {
                return await sdk.sandbox.getSandboxOrderState({ accountId, orderId }); // priceType
            },

            postOrder: async ( // eslint-disable-line max-params
                accountId: string,
                instrumentId: string,
                quantity: number,
                price: Quotation,
                direction: OrderDirection,
                orderType: OrderType,
                orderId: string,
            ) => {
                return await sdk.sandbox.postSandboxOrder({
                    accountId,
                    instrumentId,
                    quantity,
                    price,
                    direction, // OrderDirection.ORDER_DIRECTION_BUY,
                    orderType, // OrderType.ORDER_TYPE_LIMIT,
                    orderId,
                });
            },

            cancelOrder: async (accountId: string, orderId: string) => {
                return await sdk.sandbox.cancelSandboxOrder({ accountId, orderId });
            },
        };

        super(accountId, _adviser, backtest, cb, options, sdk);
    }
}
