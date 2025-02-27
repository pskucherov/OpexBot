/* eslint @typescript-eslint/no-explicit-any: 0 */
/* eslint @typescript-eslint/ban-types: 0 */

import { createSdk } from 'tinkoff-sdk-grpc-js';
import { OrderDirection, OrderType, TimeInForceType } from 'tinkoff-sdk-grpc-js/dist/generated/orders';
import { TRequests as TRequestsBase } from '../TRequests/TRequests';
import { getRandomInt } from '../../src/utils';
import { Quotation } from 'tinkoff-sdk-grpc-js/dist/generated/common';

try {
    const { Backtest } = require('../Common/TsBacktest');

    const path = require('path');
    const name = __dirname.split(path.sep).pop();

    /**
     * Заготовка торгового робота.
     */
    class Bot extends Backtest {
        static async closeAllByLimitPrice(sdk: ReturnType<typeof createSdk>,
            props: { accountId: string; allInstrumentsWithIdKeys?: any; }) {
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

                const allPortfolio = await sdk?.operations?.getPortfolio({
                    accountId,
                });

                // @ts-ignore
                const positions = ([].concat(p.securities, p.futures, p.options, p.bonds));

                for (let i = 0; i < positions.length; i++) {
                    const position: {
                        instrumentUid: string;
                        balance: number;
                    } = positions[i];

                    if (!position) {
                        continue;
                    }

                    try {
                        const id = position.instrumentUid;
                        const portfolio = allPortfolio?.positions.find(p => p.instrumentUid === id);
                        const info = allInstrumentsWithIdKeys?.[id];

                        if (info?.lot && id && props.accountId && portfolio?.currentPrice) {
                            const orderData = {
                                accountId: props.accountId,
                                instrumentId: id,
                                quantity: -1 * Math.floor(position.balance / info?.lot),
                                orderType: OrderType.ORDER_TYPE_LIMIT,
                                price: portfolio.currentPrice,
                                timeInForceType: TimeInForceType.TIME_IN_FORCE_FILL_AND_KILL,
                            };

                            await this.order(
                                sdk,
                                orderData,
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

        static async closeAllOrders(
            sdk: ReturnType<typeof createSdk>,
            TRequests: InstanceType<typeof TRequestsBase>,
            props: { accountId: string; allInstrumentsWithIdKeys?: any; },
        ) {
            const {
                accountId,
            } = props;

            const { orders } = (await sdk?.orders.getOrders({
                accountId,
            })) || {};

            if (orders?.length) {
                for (let i = 0; i < orders.length; i++) {
                    if (![4, 5].includes(orders[i].executionReportStatus)) {
                        continue;
                    }

                    await TRequests.cancelOrder(accountId, orders[i].orderId);

                    // await sdk.orders.cancelOrder({
                    //     accountId,
                    //     orderId: orders[i].orderId,
                    // });
                }
            }
        }

        static async closeAllByMarket(sdk: ReturnType<typeof createSdk>, props: {
            accountId: string;
            TRequests: InstanceType<typeof TRequestsBase>,
            allInstrumentsWithIdKeys?: any;
        }) {
            return await this.closeAll(sdk, {
                ...props,
                closeBy: 'market',
            });
        }

        static async closeAllByBestPrice(sdk: ReturnType<typeof createSdk>, props: {
            accountId: string;
            TRequests: InstanceType<typeof TRequestsBase>,
            allInstrumentsWithIdKeys?: any;
        }) {
            return await this.closeAll(sdk, {
                ...props,
                closeBy: 'bestprice',
            });
        }

        static async closeAll(sdk: ReturnType<typeof createSdk>, props: {
            accountId: string; allInstrumentsWithIdKeys?: any;
            TRequests: InstanceType<typeof TRequestsBase>,
            closeBy: 'bestprice' | 'market' | 'spread',
        }) {
            try {
                if (!sdk?.operations?.getPositions) {
                    return;
                }

                const {
                    accountId,
                    allInstrumentsWithIdKeys,
                    closeBy,
                    TRequests,
                } = props;

                const p = await sdk?.operations?.getPositions({
                    accountId,
                });

                // @ts-ignore
                const positions = ([].concat(p.securities, p.futures, p.options, p.bonds));

                for (let i = 0; i < positions.length; i++) {
                    const position: {
                        instrumentUid: string;
                        balance: number;
                    } = positions[i];

                    if (!position) {
                        continue;
                    }

                    try {
                        const id = position.instrumentUid;
                        const info = allInstrumentsWithIdKeys?.[id];

                        if (info?.lot && id && props.accountId) {
                            const data = {
                                accountId: props.accountId,
                                instrumentId: id,
                                quantity: -1 * Math.floor(position.balance / info?.lot),
                                orderType: closeBy === 'bestprice' ? OrderType.ORDER_TYPE_BESTPRICE :
                                    OrderType.ORDER_TYPE_MARKET,
                            };

                            if (closeBy === 'spread') {
                                await this.spreadOrdersByOrderBook(sdk, TRequests, {
                                    accountId,
                                    instrumentId: id,
                                    quantity: -1 * Math.floor(position.balance / info?.lot),
                                });
                            } else {
                                await this.order(
                                    sdk,
                                    data,
                                );
                            }
                        }
                    } catch (e) {
                        console.log('closeAllByBestPrice', e); // eslint-disable-line no-console
                    }
                }
            } catch (e) {
                console.log('closeAllByBestPrice', e); // eslint-disable-line no-console
            }
        }

        static async closeAllBySpread(sdk: ReturnType<typeof createSdk>,
            TRequests: InstanceType<typeof TRequestsBase>,
            props: {
                accountId: string;
                allInstrumentsWithIdKeys?: any;
            }) {
            return await this.closeAll(sdk, {
                ...props,
                TRequests,
                closeBy: 'spread',
            });
        }

        static async orderByBestPrice(sdk: ReturnType<typeof createSdk>,
            _TRequests: InstanceType<typeof TRequestsBase>, props: {
                accountId: string;
                instrumentId: string;
                quantity: number;
            }) {
            try {
                const {
                    accountId,
                    instrumentId,
                    quantity,
                } = props;

                if (instrumentId && accountId && quantity) {
                    const data = {
                        accountId,
                        instrumentId,
                        quantity,
                        orderType: OrderType.ORDER_TYPE_BESTPRICE,
                    };

                    return await this.order(
                        sdk,
                        data,
                    );
                }
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }
        }

        static setOrderPrices(orders: {
            [x: string]: {
                price: Quotation,
                quantity: number;
            };
        },
        pricesList: {
                quantity: number;
                price: Quotation;
            }[],
        lastQuantityBase: number, quantsArrBase: number[],
        params: {
                median: number;
                priceFrom?: number;
                priceTo?: number;
            },
        ) {
            const {
                median,
                priceFrom,
                priceTo,
            } = params;

            const quantsArr = quantsArrBase;
            let lastQuantity = lastQuantityBase;

            for (let i = 0; i < pricesList.length; i++) {
                const fullQuant = median <= 1 ? 1 : Math.floor(pricesList[i].quantity / median);
                const curQuant = Math.min(lastQuantity, fullQuant);

                lastQuantity -= curQuant;
                const price = this.getPrice(pricesList[i].price);

                if (priceFrom && priceTo && (price < priceFrom || price > priceTo)) {
                    continue;
                }

                if (!orders[price]) {
                    orders[price] = {
                        price: pricesList[i].price,
                        quantity: curQuant,
                    };
                } else {
                    orders[price].quantity += curQuant;
                }

                quantsArr.push(curQuant);

                if (!lastQuantity) {
                    break;
                }
            }

            return {
                ordersBase: orders,
                lastQuantityBase: lastQuantity,
                quantsArrBase: quantsArr,
            };
        }

        static distributionRemainingPrices(
            orders: {
                [x: string]: {
                    price: Quotation, quantity: number;
                };
            },
            pricesList: {
                quantity: number;
                price: Quotation;
            }[],
            lastQuantityBase: number, quantsArr: number[],
            params: {
                isBuy: boolean; limDown: number;
                limUp: number; min: Quotation;
                priceFrom?: number;
                priceTo?: number;
            },
            step: number = 10,
        ) {
            let lastQuantity = lastQuantityBase;

            const {
                isBuy,
                min,
                limDown,
                limUp,
                priceFrom,
                priceTo,
            } = params;

            const { minQuant, maxQuant } = quantsArr.reduce(
                (acc: { minQuant: number; maxQuant: number; }, val: number) => {
                    return {
                        minQuant: Math.min(acc.minQuant, val),
                        maxQuant: Math.max(acc.maxQuant, val),
                    };
                }, {
                    minQuant: quantsArr?.[0] || 1,
                    maxQuant: quantsArr?.[0] || 1,
                });

            const priceFromStart = Boolean(priceFrom && priceTo);
            const lastPrice = pricesList[priceFromStart ? 0 : (pricesList.length - 1)];
            const maxLenLoop = priceFromStart ? pricesList.length + 50 : 50;
            const minPrice = this.getPrice(min);

            for (let i = 1; i <= maxLenLoop; i++) {
                const nextPrice = this.getPrice(lastPrice.price) + ((isBuy ? -step : step) * minPrice) * i;

                if (nextPrice <= limDown || nextPrice >= limUp) {
                    break;
                }

                if (priceFrom && priceTo && (nextPrice < priceFrom || nextPrice > priceTo)) {
                    continue;
                }

                const curQuant = Math.min(lastQuantity, getRandomInt(minQuant, maxQuant));

                lastQuantity -= curQuant;

                if (!orders[nextPrice]) {
                    const unitsPrice = this.resolveMinPriceIncrement(this.getQuotationFromPrice(nextPrice), min);

                    orders[this.getPrice(unitsPrice)] = {
                        price: unitsPrice,
                        quantity: curQuant,
                    };
                } else {
                    orders[nextPrice].quantity += curQuant;
                }

                if (!lastQuantity) {
                    break;
                }
            }

            return {
                ordersBase: orders,
                lastQuantityBase: lastQuantity,
            };
        }

        static async getSpreadOrderMapByFromTo(sdk: ReturnType<typeof createSdk>,
            TRequests: InstanceType<typeof TRequestsBase>, props: {
                accountId: string; instrumentId: string;
                quantity: number;
                priceFrom: number;
                priceTo: number;
                isTP: boolean;
                isSL: boolean;
                isBuy: boolean;
            }) {
            try {
                const {
                    instrumentId,
                    quantity: quantityBase,

                    priceFrom = 0,
                    priceTo = 0,
                    isTP,
                    isSL,
                    isBuy,
                } = props;

                if (!TRequests || !sdk) {
                    return;
                }

                const {
                    // bids,
                    // asks,
                    limitDown,
                    limitUp,
                    lastPrice: lastPriceBase,
                    lastPriceTs,
                } = (await TRequests.getOrderBook({
                    depth: 50,
                    instrumentId,
                })) || {};

                if (!limitDown || !limitUp) {
                    return;
                }

                // Обновляем последнюю цену, если она актуальна,
                // т.к. если нет сделок по инструменту, то цены не будет вообще.
                TRequests?.updateLastPrice(instrumentId, lastPriceBase, lastPriceTs, true);

                const lastPrice = this.getPrice(lastPriceBase);

                const minQuotation = TRequests?.allInstrumentsInfo?.[instrumentId]?.minPriceIncrement;
                const min = this.getPrice(minQuotation);

                if (!min || !minQuotation) {
                    return;
                }

                const quantity = Math.abs(quantityBase);

                const limDown = this.getPrice(limitDown);
                const limUp = this.getPrice(limitUp);

                // console.log(1, 'isSL', isSL, 'priceTo', priceTo);
                if (isTP && priceFrom) {
                    let limDownPrice;
                    let limUpPrice;

                    if (isBuy) {
                        limDownPrice = priceFrom;
                        limUpPrice = limUp;
                    } else {
                        limDownPrice = limDown;
                        limUpPrice = priceFrom;
                    }

                    // console.log('isBuy', isBuy);
                    // console.log('tp', 'lastPrice', lastPrice, 'limDownPrice', limDownPrice, 'limUpPrice', limUpPrice);
                    return this.distributeLots(quantity,
                        this.getPrice(limDownPrice), this.getPrice(limUpPrice), minQuotation, !isBuy);
                } else if (isSL && priceTo) {
                    let limDownPrice;
                    let limUpPrice;

                    if (isBuy) {
                        limDownPrice = Math.max(limDown, priceTo);
                        limUpPrice = lastPrice;
                    } else {
                        limDownPrice = lastPrice;
                        limUpPrice = Math.min(limUp, priceTo);
                    }

                    return this.distributeLots(quantity,
                        this.getPrice(limDownPrice), this.getPrice(limUpPrice), minQuotation, !isBuy);
                }

                // if ((priceFrom || priceTo) && (isTP || isSL)) {
                //     if (priceFrom) {
                //         const limDownPrice = Math.max(Math.min(priceFrom, lastPrice), limDown);
                //         const limUpPrice = Math.min(Math.max(priceFrom, lastPrice), limUp);

                //         return this.distributeLots(quantity, limDownPrice, limUpPrice, minQuotation);
                //     } else if (priceTo) {
                //         const limDownPrice = Math.max(Math.min(priceTo, lastPrice), limDown);
                //         const limUpPrice = Math.min(Math.max(priceTo, lastPrice), limUp);

                //         return this.distributeLots(quantity, limDownPrice, limUpPrice, minQuotation, Boolean(!isBuy && isSL));
                //     }
                // }
            } catch (e) {
                console.log(e); // eslint-disable-line
            }

            return undefined;
        }

        static async getSpreadOrderMapByOrderBook(sdk: ReturnType<typeof createSdk>,
            TRequests: InstanceType<typeof TRequestsBase>, props: {
                accountId?: string; instrumentId: string;
                quantity: any; price?: string | undefined;
                orderType?: OrderType | undefined; timeInForceType?: TimeInForceType | undefined;
            }) {
            let orders = {};

            try {
                const {
                    instrumentId,
                    quantity: quantityBase,
                } = props;

                if (!TRequests || !sdk) {
                    return;
                }

                const {
                    bids,
                    asks,
                    limitDown,
                    limitUp,
                } = (await TRequests.getOrderBook({
                    depth: 50,
                    instrumentId,
                })) || {};

                if (!bids && !asks) {
                    return;
                }

                const minQuotation = TRequests?.allInstrumentsInfo?.[instrumentId]?.minPriceIncrement;
                const min = this.getPrice(minQuotation);

                if (!min || !minQuotation) {
                    return;
                }

                const isBuy = quantityBase > 0;
                const quantity = Math.abs(quantityBase);

                const limDown = this.getPrice(limitDown);
                const limUp = this.getPrice(limitUp);

                const arrData = isBuy ? bids : asks;

                const median = Bot.median(arrData.map((a: { quantity: number; }) => a.quantity));
                const pricesList = arrData.filter((a: { quantity: number; }) => a.quantity >= median);

                let lastQuantity = quantity;

                if (!pricesList?.length) {
                    return;
                }

                let whileCount = 0;

                do {
                    let quantsArr: number[] = [];

                    const {
                        ordersBase,
                        lastQuantityBase,
                        quantsArrBase,
                    } = this.setOrderPrices(orders, pricesList, lastQuantity, quantsArr, {
                        median,
                    });

                    quantsArr = quantsArrBase;

                    orders = ordersBase;
                    lastQuantity = lastQuantityBase;

                    if (lastQuantity) {
                        const {
                            ordersBase,
                            lastQuantityBase,
                        } = this.distributionRemainingPrices(orders, pricesList, lastQuantity, quantsArr, {
                            isBuy,
                            limDown,
                            limUp,
                            min,
                        });

                        orders = ordersBase;
                        lastQuantity = lastQuantityBase;
                    }

                    ++whileCount;
                } while (lastQuantity > 0 && whileCount < 100);
            } catch (e) {
                console.log(e); // eslint-disable-line
            }

            return orders;
        }

        static async spreadOrdersByOrderBook(sdk: ReturnType<typeof createSdk>,
            TRequests: InstanceType<typeof TRequestsBase>,
            props: {
                accountId: string;
                instrumentId: string;
                quantity: number;
                price?: string;
                orderType?: OrderType;
                timeInForceType?: TimeInForceType;
            },
        ) {
            if (!sdk || !TRequests) {
                throw 'В order не передан sdk';
            }

            const {
                accountId,

                // price,
                instrumentId,
                quantity,

                // orderType,
                // timeInForceType,
            } = props;

            const isBuy = quantity > 0;

            try {
                if (!TRequests.postOrder || !accountId || !quantity) {
                    return;
                }
                const orders: {
                    [key: string]: any;
                } = (await this.getSpreadOrderMapByOrderBook(sdk, TRequests, props)) || {};

                const keys = Object.keys(orders);

                for (let i = 0; i < keys.length; i++) {
                    try {
                        const key = keys[i];
                        const { price, quantity } = orders?.[key];

                        const data = {
                            accountId,
                            instrumentId,
                            quantity,
                            price,
                            direction: isBuy ? OrderDirection.ORDER_DIRECTION_BUY : OrderDirection.ORDER_DIRECTION_SELL,
                            orderType: OrderType.ORDER_TYPE_LIMIT,
                            orderId: this.genOrderId(),
                        };

                        await TRequests.postOrder(data);
                    } catch (e) {
                        console.log(e); // eslint-disable-line no-console
                    }
                }
            } catch (e) {
                console.log(e); // eslint-disable-line
            }
        }

        static distributeLots(N: number, minPrice: number,
            maxPrice: number, minQuotation: Quotation, fromTop = false) {
            const prices = [];

            try {
                if (fromTop) {
                    // console.log(1, 'fromTop', maxPrice, minPrice,
                    //     this.getQuotationFromPrice(maxPrice),
                    //     'maxPrice', this.resolveMinPriceIncrement(this.getQuotationFromPrice(maxPrice), minQuotation),
                    //     'minPrice', minPrice,
                    //     this.getPrice(this.resolveMinPriceIncrement(this.getQuotationFromPrice(maxPrice), minQuotation)) > minPrice,
                    //     this.subMinPriceIncrement(this.resolveMinPriceIncrement(this.getQuotationFromPrice(maxPrice), minQuotation), minQuotation)
                    // );
                    for (let price = this.resolveMinPriceIncrement(this.getQuotationFromPrice(maxPrice), minQuotation);
                        this.getPrice(price) > minPrice;
                        price = this.subMinPriceIncrement(price, minQuotation)
                    ) {
                        // console.log(price);
                        prices.push(price);
                    }
                } else {
                    // console.log(1, 'else');
                    for (let price = this.resolveMinPriceIncrement(this.getQuotationFromPrice(minPrice), minQuotation);
                        this.getPrice(price) < maxPrice;
                        price = this.addMinPriceIncrement(price, minQuotation)
                    ) {
                        prices.push(price);
                    }
                }
            } catch (e) {
                console.log(e); // eslint-disable-line

                return [];
            }

            // console.log('prices', prices);

            const totalSteps = prices.length;
            const lotMap = new Map();

            if (fromTop) {
                for (let i = N - 1; i >= 0; i--) {
                    const index = Math.floor(i * totalSteps / N);
                    const price = prices[index];

                    lotMap.set(price, (lotMap.get(price) || 0) + 1);
                }
            } else {
                for (let i = 0; i < N; i++) {
                    const index = Math.floor(i * totalSteps / N);
                    const price = prices[index];

                    lotMap.set(price, (lotMap.get(price) || 0) + 1);
                }
            }

            return Array
                .from(lotMap, ([price, quantity]) => ({
                    price,
                    quantity,
                }))
                .filter(p => p.price && p.quantity)
                .sort((a, b) => this.getPrice(a.price) - this.getPrice(b.price));
        }
    }

    if (name) {
        module.exports[name] = Bot;
    }
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
