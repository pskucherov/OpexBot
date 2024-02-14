import { createSdk } from 'tinkoff-sdk-grpc-js';

// import { DeepPartial } from 'tinkoff-sdk-grpc-js/dist/generated/common';
import { DeepPartial, MarketDataRequest, SubscriptionAction } from 'tinkoff-sdk-grpc-js/dist/generated/marketdata';
import { TOKEN } from '../../config';

// import { DeepPartial, MarketDataRequest, SubscriptionAction, SubscriptionInterval } from '../generated/marketdata';
import { logger } from '../../src/utils';

!(async function example() {
    const { marketDataStream } = createSdk(TOKEN, 't4', logger);

    const keepCalling = true;

    // setTimeout(function () {
    //     keepCalling = false;
    // }, 50000);

    // const timer = (time: number) => new Promise(resolve => setTimeout(resolve, time));

    //генератор для последней цены инструмента
    // async function* createLastPriceRequest(): AsyncIterable<DeepPartial<MarketDataRequest>> {
    //     while (keepCalling) {
    //         await timer(1000);
    //         yield MarketDataRequest.fromPartial({
    //             subscribeLastPriceRequest: {
    //                 subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
    //                 instruments: [{ instrumentId: 'e6123145-9665-43e0-8413-cd61b8aa9b13' }, { instrumentId: '0da66728-6c30-44c4-9264-df8fac2467ee' }],
    //             },
    //         });
    //     }
    // }

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

    // генератор для получения обезличенных сделок
    async function* createSubscriptionTradesRequest(): AsyncIterable<DeepPartial<MarketDataRequest>> {
        try {
            while (keepCalling) {
                // await timer(1000);
                yield MarketDataRequest.fromPartial({
                    subscribeTradesRequest: {
                        subscriptionAction: SubscriptionAction.SUBSCRIPTION_ACTION_SUBSCRIBE,
                        instruments: [{ instrumentId: 'a8dc188b-cae8-40c0-99e8-f561f4339751' }],
                    },
                });
            }
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

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

    const response = marketDataStream.marketDataStream(createSubscriptionTradesRequest());

    for await (const num of response) {
        try {
            const { trade } = num || {};

            if (trade) {
                console.log(trade.direction, trade.price, trade.quantity, trade.time); // eslint-disable-line no-console
            }
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }
})();

// setInterval(() => {}, 5000);
