import { createSdk } from 'tinkoff-sdk-grpc-js';
import { MarketDataRequest, SubscriptionAction, SubscriptionInterval } from 'tinkoff-sdk-grpc-js/dist/generated/marketdata';

function createSubscriptionCandleRequest(instrumentId: string | string[]): MarketDataRequest {
    return MarketDataRequest.fromPartial({
        subscribeCandlesRequest: {
            subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
            instruments: (Array.isArray(instrumentId) ? instrumentId : [instrumentId]).map(i => {
                return {
                    instrumentId: i,
                    interval: SubscriptionInterval.SUBSCRIPTION_INTERVAL_ONE_MINUTE,
                };
            }),
            waitingClose: true,
        },
    });
}

function getCreateSubscriptionOrderBookRequest(instrumentId: string | string[]) {
    return MarketDataRequest.fromJSON({
        subscribeOrderBookRequest: {
            subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
            instruments: Array.isArray(instrumentId) ?
                instrumentId.map(f => {
                    return { instrumentId: f, depth: 50 };
                }) : [{ instrumentId, depth: 50 }],
        },
    });
}

function getCreateSubscriptionLastPriceRequest(instrumentId: string | string[]) {
    return MarketDataRequest.fromPartial({
        subscribeLastPriceRequest: {
            subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
            instruments: Array.isArray(instrumentId) ?
                instrumentId.map(f => { return { instrumentId: f } }) : [{ instrumentId }],
        },
    });
}

export const lastPriceSubscribe = (sdk: ReturnType<typeof createSdk>) => {
    try {
        return [
            sdk.marketDataStream.marketDataStream,
            getCreateSubscriptionLastPriceRequest,
        ];
    } catch (e) {
        console.log(e); // eslint-disable-line no-console
    }

    return undefined;
};

export const candlesSubscribe = (sdk: ReturnType<typeof createSdk>) => {
    try {
        return [
            sdk.marketDataStream.marketDataStream,
            createSubscriptionCandleRequest,
        ];
    } catch (e) {
        console.log(e); // eslint-disable-line no-console
    }

    return undefined;
};

export const orderBookSubscribe = (sdk: ReturnType<typeof createSdk>) => {
    try {
        return [
            sdk.marketDataStream.marketDataStream,
            getCreateSubscriptionOrderBookRequest,
        ];
    } catch (e) {
        console.log(e); // eslint-disable-line no-console
    }

    return undefined;
};
