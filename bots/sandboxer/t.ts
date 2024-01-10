import { createSdk } from 'tinkofftradingbotconnector/node_modules/tinkoff-sdk-grpc-js';

// import { DeepPartial } from 'tinkofftradingbotconnector/node_modules/tinkoff-sdk-grpc-js/dist/generated/common';
import { DeepPartial, MarketDataRequest, SubscriptionAction } from 'tinkofftradingbotconnector/node_modules/tinkoff-sdk-grpc-js/dist/generated/marketdata';

// import { DeepPartial, MarketDataRequest, SubscriptionAction, SubscriptionInterval } from '../generated/marketdata';

!(async function example() {
    const { marketDataStream } = createSdk('');

    let keepCalling = true;

    setTimeout(function() {
        keepCalling = false;
    }, 50000);

    const timer = (time: number) => new Promise(resolve => setTimeout(resolve, time));

    //генератор для последней цены инструмента
    async function* createLastPriceRequest(): AsyncIterable<DeepPartial<MarketDataRequest>> {
        while (keepCalling) {
            await timer(1000);
            yield MarketDataRequest.fromPartial({
                subscribeLastPriceRequest: {
                    subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
                    instruments: [{ instrumentId: 'e6123145-9665-43e0-8413-cd61b8aa9b13' }, { instrumentId: '0da66728-6c30-44c4-9264-df8fac2467ee' }],
                },
            });
        }
    }

    // //генератор для торгового статуса инструмента
    // async function* createSubscriptionInfoRequest(): AsyncIterable<DeepPartial<MarketDataRequest>> {
    //   while (keepCalling) {
    //     await timer(1000);
    //     yield MarketDataRequest.fromPartial({
    //       subscribeInfoRequest: {
    //         subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
    //         instruments: [{ figi: 'BBG000N9MNX3' }],
    //       },
    //     });
    //   }
    // }

    // // генератор для получения обезличенных сделок
    // async function* createSubscriptionTradesRequest(): AsyncIterable<DeepPartial<MarketDataRequest>> {
    //   while (keepCalling) {
    //     await timer(1000);
    //     yield MarketDataRequest.fromPartial({
    //       subscribeTradesRequest: {
    //         subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
    //         instruments: [{ figi: 'BBG000N9MNX3' }],
    //       },
    //     });
    //   }
    // }

    // //генератор подписка на стаканы
    // async function* createSubscriptionOrderBookRequest(): AsyncIterable<DeepPartial<MarketDataRequest>> {
    //   while (keepCalling) {
    //     await timer(1000);
    //     yield MarketDataRequest.fromPartial({
    //       subscribeOrderBookRequest: {
    //         subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
    //         instruments: [{ figi: 'BBG000N9MNX3', depth: 5 }],
    //       },
    //     });
    //   }
    // }

    // //генератор подписки на свечи
    // async function* createSubscriptionCandleRequest(): AsyncIterable<DeepPartial<MarketDataRequest>> {
    //   while (keepCalling) {
    //     await timer(1000);
    //     yield MarketDataRequest.fromPartial({
    //       subscribeCandlesRequest: {
    //         subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
    //         instruments: [{ figi: 'BBG000N9MNX3', interval: SubscriptionInterval.SUBSCRIPTION_INTERVAL_ONE_MINUTE }],
    //       },
    //     });
    //   }
    // }

    const response = marketDataStream.marketDataStream(createLastPriceRequest());

    for await (const num of response) {
        console.log(JSON.stringify(num, null, 4)); // eslint-disable-line no-console
    }
})();
