// const { throws } = require('assert');
// const { parse } = require('path');

import { MoneyValue, Quotation } from 'tinkoff-sdk-grpc-js/dist/generated/common';
import { TRequests as TRequestsBase } from '../TRequests/TRequests';

// import { StopOrderStatusOption, StopOrderDirection, StopOrderExpirationType, StopOrderType } from 'tinkoff-sdk-grpc-js/dist/generated/stoporders';
import { Common } from '../Common/TsCommon';
import { Share } from 'tinkoff-sdk-grpc-js/dist/generated/instruments';

// @ts-ignore
import { StaticExample } from '../StaticExample';
import { PortfolioPosition } from 'tinkoff-sdk-grpc-js/dist/generated/operations';
import {
    OrderDirection,
    OrderState,
    OrderStateStreamResponse_OrderState, // eslint-disable-line camelcase
    OrderType,
    PostOrderResponse,
    TimeInForceType,
} from 'tinkoff-sdk-grpc-js/dist/generated/orders';
import { GetTradingStatusResponse } from 'tinkoff-sdk-grpc-js/dist/generated/marketdata';
import EventEmitterBase from 'events';

// import { InstrumentStatus } from "tinkoff-sdk-grpc-js/dist/generated/instruments";

interface IFastTPSL {
    price: MoneyValue | undefined;
    quantity: number;
    order?: OrderState | PostOrderResponse;
}

try {
    const path = require('path');
    const name = __dirname.split(path.sep).pop();

    /**
     * Заготовка торгового робота.
     */
    class Bot extends Common {
        // instrument — торгует одним инструментом. portfolio — всем портфелем.
        static type = 'AutoProfit.v2';
        name: string | undefined;

        iagreetrade!: boolean;
        profitRange!: number;

        TRequests!: InstanceType<typeof TRequestsBase>;

        // SLMap!: unknown;
        // TPMap!: unknown;
        // FastTPMap!: unknown;

        decisionBuyPositionMessage!: string;
        decisionClosePositionMessage!: string | number;
        allInstrumentsInfo: {
            [key: string]: Share
        } = {};
        TPSLMap: {
            [x: string]: {
                fastTP: (IFastTPSL | undefined)[];
                SL: (IFastTPSL | undefined)[];

                // orders?: PostOrderResponse[];
                closed: unknown[];
                reopened: unknown[];
                closedOrders: unknown[],
                fastTPQuantity: number;
                SLQuantity: number;
                reopenedQuantity: number;
                profit: number;
                profitYield: number;
            }
        };
        tradingStatuses!: { [x: string]: GetTradingStatusResponse };
        onTradeDataBinded!: (data: OrderStateStreamResponse_OrderState) => Promise<void>; // eslint-disable-line camelcase
        eventEmitter!: InstanceType<typeof EventEmitterBase>;

        // @ts-ignore
        constructor(...args) {
            // @ts-ignore
            super(...args);

            this.type = Bot.type;
            this.isPortfolio = false;
            this.name = name;

            this.TPSLMap = {
                // fastTP: [],
                // SL: [],
                // orders: [],
                // closed: [],
                // reopened: [],
            };
        }

        async createTPOrder(currentOrder: (IFastTPSL | undefined), instrumentId: string, isBuy: boolean) {
            try {
                if (!currentOrder) {
                    return false;
                }

                const {
                    price,
                    quantity,
                    order,
                } = currentOrder;

                const sdk = this.sdk;

                if (!sdk) {
                    return false;
                }

                if (order) {
                    console.log('replace order'); // eslint-disable-line
                    console.log('next currentOrder'); // eslint-disable-line
                    console.log(currentOrder); // eslint-disable-line

                    console.log('order'); // eslint-disable-line
                    console.log(currentOrder.order); // eslint-disable-line
                    console.log(); // eslint-disable-line

                    const data = {
                        accountId: this.accountId,
                        orderId: order?.orderId,
                        quantity,
                        price,
                        idempotencyKey: this.genOrderId(),
                    };

                    currentOrder.order = await this.TRequests.replaceOrder(data);

                    return true;
                } else {
                    const data = {
                        accountId: this.accountId,
                        instrumentId,
                        quantity,
                        price,
                        direction: isBuy ?
                            OrderDirection.ORDER_DIRECTION_BUY :
                            OrderDirection.ORDER_DIRECTION_SELL,
                        orderType: OrderType.ORDER_TYPE_LIMIT,
                        orderId: this.genOrderId(),
                    };

                    currentOrder.order = await this.TRequests.postOrder(data);
                }

                return true;
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }

            return false;
        }

        async syncLimitOrderMap(currentOrders: (IFastTPSL | undefined)[], instrumentId: string, isBuy: boolean) {
            try {
                const sdk = this.sdk;

                if (!currentOrders?.length || !sdk) {
                    return;
                }

                for (let i = 0; i < currentOrders.length; i++) {
                    if (currentOrders[i]) {
                        await this.createTPOrder(currentOrders[i], instrumentId, isBuy);
                    }
                }
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }
        }

        async createMaps(props: { accountId: string; positions: PortfolioPosition[]; }) { // eslint-disable-line 
            try {
                const {
                    positions,
                } = props;

                for (let i = 0; i < positions.length; i++) {
                    const {
                        instrumentUid,
                        averagePositionPrice,
                        instrumentType,
                    } = positions[i];

                    const {
                        marketOrderAvailableFlag,
                        apiTradeAvailableFlag,
                        limitOrderAvailableFlag,
                    } = this.tradingStatuses?.[instrumentUid] || {};

                    if (instrumentType !== 'share' || !apiTradeAvailableFlag) {
                        continue;
                    }

                    const averagePositionPriceVal = Common.getPrice(averagePositionPrice);
                    const {
                        lot,
                        minPriceIncrement: min,

                        // ticker,
                    } = this.allInstrumentsInfo?.[instrumentUid] || {};

                    if (!averagePositionPrice || !averagePositionPriceVal ||
                        !lot || !min) {
                        continue;
                    }

                    this.TPSLMap[instrumentUid] || (this.TPSLMap[instrumentUid] = {
                        fastTP: [],
                        SL: [],
                        closed: [],
                        closedOrders: [],
                        reopened: [],
                        fastTPQuantity: 0,
                        SLQuantity: 0,
                        reopenedQuantity: 0,
                        profit: 0,
                        profitYield: 0,
                    });

                    if (!marketOrderAvailableFlag) {
                        this.TPSLMap[instrumentUid].SL = [];
                        this.TPSLMap[instrumentUid].SLQuantity = 0;
                    }

                    if (!limitOrderAvailableFlag) {
                        this.TPSLMap[instrumentUid].fastTP = [];
                        this.TPSLMap[instrumentUid].fastTPQuantity = 0;
                    }

                    if (!marketOrderAvailableFlag && !limitOrderAvailableFlag) {
                        continue;
                    }

                    // if (![
                    //     'e6123145-9665-43e0-8413-cd61b8aa9b13',
                    //     // '2c69924a-fcf4-4d3c-8c02-02cd665f554d',
                    // ].includes(instrumentUid)) {
                    //     continue;
                    // }

                    // if (ticker !== 'SBER' && lot === 1) {
                    //     continue;
                    // }

                    // if (ticker === 'SVCB') {
                    //     // console.log(this.currentOrders);
                    //     console.log('instrumentInOrders', instrumentInOrders);
                    //     console.log(instrumentUid);
                    //     console.log(ticker);
                    // }

                    // if (1) {
                    //     continue;
                    // }

                    // console.log('slPoint', slPoint, 'currentPriceNum', currentPriceNum);
                    if (limitOrderAvailableFlag) {
                        await this.syncTPMap(positions[i]);
                    }

                    if (marketOrderAvailableFlag) {
                        await this.syncSLMap(positions[i]);
                    }
                }
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }
        }

        restoreTPFromOrders(instrumentUid: string, instrumentInOrders: OrderState[]) {
            this.TPSLMap[instrumentUid].fastTP = [];

            let fastTPQuantity = 0;

            instrumentInOrders.forEach(i => {
                fastTPQuantity += i.lotsRequested - i.lotsExecuted;

                this.TPSLMap[instrumentUid].fastTP.push({
                    price: i.initialSecurityPrice,
                    quantity: i.lotsRequested - i.lotsExecuted,
                    order: i,
                });
            });

            this.TPSLMap[instrumentUid].fastTPQuantity = fastTPQuantity;

            this.TPSLMap[instrumentUid].fastTP
                .sort((a, b) => (this.getPrice(a?.price) || 0) - (this.getPrice(b?.price) || 0));
        }

        async syncTPMap(position: PortfolioPosition) {
            try {
                const {
                    instrumentUid,
                    averagePositionPrice,
                    quantity,
                    currentPrice,
                    averagePositionPriceFifo,
                    blockedLots,
                } = position;

                const blockedNum = Math.abs(this.getPrice(blockedLots));

                const quantityNum = this.getPrice(quantity);
                const avalibleQuantity = Math.abs(quantityNum) - blockedNum;

                const currentPriceNum = this.getPrice(currentPrice);
                const isBuy = quantityNum > 0;

                const averagePositionPriceVal = Common.getPrice(averagePositionPrice);
                const {
                    lot,
                    minPriceIncrement: min,

                    // ticker,
                } = this.allInstrumentsInfo?.[instrumentUid] || {};

                if (!lot || !min) {
                    return;
                }

                const startTPPrice = isBuy ?
                    Math.max(currentPriceNum, averagePositionPriceVal, this.getPrice(averagePositionPriceFifo)) :
                    Math.min(currentPriceNum, averagePositionPriceVal, this.getPrice(averagePositionPriceFifo));

                const tpPoint = this.getTPPoint(startTPPrice, !isBuy, this.takeProfit, min);

                const instrumentInOrders = this.currentOrders.filter(o => o.instrumentUid === instrumentUid);

                if (instrumentInOrders?.length && !this.TPSLMap[instrumentUid].fastTP?.length) {
                    this.restoreTPFromOrders(instrumentUid, instrumentInOrders);
                }

                {
                    // Переоткрытие
                    // if (this.iagreetrade && !this.TPSLMap[instrumentUid].reopened?.length) {
                    //     const orderDataReopen = await StaticExample.getSpreadOrderMapByFromTo(this.sdk,
                    //         this.TRequests,
                    //         {
                    //             accountId,
                    //             instrumentId: instrumentUid,
                    //             quantity: Math.floor(Math.abs(quantityNum / lot)),
                    //             priceFrom: slPoint,
                    //             isTP: true,
                    //             isBuy: !isBuy,
                    //         });

                    //     console.log('ticker reopen', ticker, orderDataReopen);
                    //     if (orderDataReopen) {
                    //         this.TPSLMap[instrumentUid].reopened = orderDataReopen; //  || this.TPSLMap[instrumentUid].fastTP;

                    //         this.TPSLMap[instrumentUid].reopenedQuantity = this.TPSLMap[instrumentUid]
                    //             .reopened?.reduce((acc, val) => acc + val.quantity, 0);
                    //     }

                    //     // if (instrumentInOrders?.length) {
                    //     //     console.log('instrumentInOrders?.length');
                    //     // } else {
                    //     await this.syncLimitOrderMap(this.TPSLMap[instrumentUid].reopened, instrumentUid, isBuy);
                    //     // }
                    // }
                }

                let priceFrom = tpPoint;

                if (isBuy && currentPriceNum > Math.max(
                    averagePositionPriceVal, this.getPrice(averagePositionPriceFifo)) ||
                    !isBuy && currentPriceNum < Math.min(
                        averagePositionPriceVal, this.getPrice(averagePositionPriceFifo))
                ) {
                    priceFrom = (tpPoint + currentPriceNum) / 2;
                }

                const orderDataTakeProfit = await StaticExample.getSpreadOrderMapByFromTo(this.sdk,
                    this.TRequests,
                    {
                        accountId: this.accountId,
                        instrumentId: instrumentUid,
                        quantity: Math.floor(Math.abs(avalibleQuantity / lot) * this.profitRange),
                        priceFrom,
                        isTP: true,

                        isBuy,
                    });

                const oldTPCount = this.TPSLMap?.[instrumentUid]?.fastTP?.reduce(
                    (acc, val) => acc + (val?.quantity || 0), 0,
                );
                const currentTPCount = orderDataTakeProfit?.reduce((
                    acc: number, val: { quantity: number; },
                ) => acc + val.quantity, 0);

                if (
                    !this.TPSLMap[instrumentUid].fastTP?.length
                ) {
                    if (orderDataTakeProfit) {
                        this.TPSLMap[instrumentUid].fastTP = orderDataTakeProfit; //  || this.TPSLMap[instrumentUid].fastTP;

                        this.TPSLMap[instrumentUid].fastTPQuantity = this.TPSLMap[instrumentUid]
                            .fastTP?.reduce((acc, val) => acc + (val?.quantity || 0), 0);
                    }

                    if (!instrumentInOrders?.length) {
                        await this.syncLimitOrderMap(this.TPSLMap[instrumentUid].fastTP, instrumentUid, !isBuy);
                    }
                } else if (oldTPCount !== currentTPCount || this.needChange(
                    this.TPSLMap[instrumentUid].fastTP,
                    orderDataTakeProfit,
                    isBuy,
                )) {
                    console.log('need change TP'); // eslint-disable-line no-console
                    console.log('FROM', this.TPSLMap[instrumentUid].fastTP); // eslint-disable-line no-console
                    console.log('TO', orderDataTakeProfit); // eslint-disable-line no-console
                    await this.syncTPOrdersInObj(instrumentUid, orderDataTakeProfit, isBuy);
                }
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }
        }

        async syncTPOrdersInObj(instrumentUid: string, nextOrders: IFastTPSL[], isBuy: boolean) {
            const currentTP = this.TPSLMap[instrumentUid].fastTP;
            const len = Math.max(this.TPSLMap[instrumentUid].fastTP?.length,
                nextOrders.length);

            for (let i = 0; i < len; i++) {
                if (!nextOrders[i] && currentTP[i]?.order?.orderId) {
                    await this.cancelOrder(currentTP[i]?.order?.orderId);
                    currentTP[i] = undefined;
                } else if (nextOrders[i] && !currentTP[i]?.order?.orderId) {
                    currentTP[i] = {
                        price: nextOrders[i].price,
                        quantity: nextOrders[i].quantity,
                    };
                    await this.createTPOrder(currentTP[i], instrumentUid, !isBuy);
                } else if (nextOrders[i] && currentTP[i]?.order?.orderId) {
                    currentTP[i] = {
                        price: nextOrders[i].price,
                        quantity: nextOrders[i].quantity,
                        order: currentTP[i]?.order,
                    };

                    await this.createTPOrder(currentTP[i], instrumentUid, !isBuy);
                }
            }

            this.TPSLMap[instrumentUid].fastTP = currentTP.filter(Boolean);
        }

        balanceQuantity(instrumentUid: string, diff: number, i: number) {
            const current = this.TPSLMap[instrumentUid].SL[i]?.quantity || 0;

            if (current) {
                const toDel = Math.min(current, diff);

                this.TPSLMap[instrumentUid].SL[i]!.quantity -= toDel;
                diff -= toDel;
            }

            return diff;
        }

        async syncSLMap(position: PortfolioPosition) {
            try {
                const {
                    instrumentUid,
                    quantity,
                    currentPrice,
                } = position;

                const quantityNum = this.getPrice(quantity);

                const currentPriceNum = this.getPrice(currentPrice);
                const isBuy = quantityNum > 0;

                const {
                    lot,
                    minPriceIncrement: min,

                    // ticker,
                } = this.allInstrumentsInfo?.[instrumentUid] || {};

                if (!lot || !min) {
                    return;
                }

                const slPoint = this.getSLPoint(currentPriceNum, !isBuy, this.stopLoss, min);

                const orderDataStopLoss = await StaticExample.getSpreadOrderMapByFromTo(this.sdk,
                    this.TRequests,
                    {
                        accountId: this.accountId,
                        instrumentId: instrumentUid,
                        quantity: Math.floor(Math.abs(quantityNum / lot)),
                        priceTo: slPoint,
                        isSL: true,
                        isBuy,
                    });

                try {
                    const oldSLCount = this.TPSLMap?.[instrumentUid]?.SL?.reduce(
                        (acc, val) => acc + (val?.quantity || 0), 0,
                    );
                    const currentSLCount = orderDataStopLoss?.reduce((
                        acc: number, val: { quantity: number; },
                    ) => acc + val.quantity, 0);

                    if (this.needChange(this.TPSLMap[instrumentUid].SL, orderDataStopLoss, isBuy)) {
                        this.TPSLMap[instrumentUid].SL = orderDataStopLoss;

                        this.TPSLMap[instrumentUid].SL
                            .sort((a, b) => (
                                this.getPrice(a?.price) || 0) - (this.getPrice(b?.price) || 0),
                            );
                    } else if (oldSLCount > currentSLCount) {
                        if (!currentSLCount) {
                            this.TPSLMap[instrumentUid].SL = [];
                        } else {
                            let diff = oldSLCount - currentSLCount;
                            const count = this.TPSLMap[instrumentUid].SL.length;

                            if (isBuy) {
                                for (let i = 0; i < count; i++) {
                                    diff = this.balanceQuantity(instrumentUid, diff, i);
                                    if (!diff) {
                                        break;
                                    }
                                }
                            } else {
                                for (let i = count - 1; i >= 0; i--) {
                                    diff = this.balanceQuantity(instrumentUid, diff, i);
                                    if (!diff) {
                                        break;
                                    }
                                }
                            }

                            this.TPSLMap[instrumentUid].SL = this.TPSLMap[instrumentUid]
                                .SL
                                .filter(sl => Boolean(sl?.quantity));
                        }
                    }
                } catch (e) {
                    console.log(e); // eslint-disable-line
                }
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }
        }

        getTPSLMap() {
            return this.TPSLMap;
        }

        /**
         * Нужно перераспределить TP, SL карты.
         * Если для покупки минимальная цена выросла.
         * Или для продажи максимальная цена стала меньше.
         *
         * @param current
         * @param next
         * @param isBuy
         * @returns
         */
        needChange(current: (IFastTPSL | undefined)[], next: IFastTPSL[], isBuy: boolean) {
            if (!current?.length || !next?.length) {
                return false;
            }

            try {
                current.sort((a, b) => (this.getPrice(a?.price) || 0) - (this.getPrice(b?.price) || 0));
                next.sort((a, b) => (this.getPrice(a?.price) || 0) - (this.getPrice(b?.price) || 0));

                if (isBuy) {
                    return this.getPrice(next?.[0]?.price) > this.getPrice(current?.[0]?.price);
                }

                return this.getPrice(
                    current?.[current?.length - 1]?.price,
                ) > this.getPrice(next?.[next.length - 1]?.price);
            } catch (e) {
                return false;
            }
        }

        async closeBySL(props: { accountId: string; positions: PortfolioPosition[]; }) {
            try {
                const {
                    accountId,
                    positions,
                } = props;

                for (let i = 0; i < positions.length; i++) {
                    const {
                        instrumentUid,
                        averagePositionPrice,
                        quantity,
                        instrumentType,
                        currentPrice,
                        blockedLots,
                    } = positions[i];

                    const blockedNum = Math.abs(this.getPrice(blockedLots));

                    const {
                        marketOrderAvailableFlag,
                        apiTradeAvailableFlag,
                    } = this.tradingStatuses?.[instrumentUid] || {};

                    if (instrumentType !== 'share' ||
                        !marketOrderAvailableFlag ||
                        !apiTradeAvailableFlag
                    ) {
                        continue;
                    }

                    try {
                        const SLLen = this.TPSLMap?.[instrumentUid]?.SL?.length || 0;
                        const averagePositionPriceVal = Common.getPrice(averagePositionPrice);
                        const {
                            lot,
                            minPriceIncrement: min,

                            // ticker,
                        } = this.allInstrumentsInfo?.[instrumentUid] || {};

                        if (!averagePositionPrice || !averagePositionPriceVal ||
                            !lot || !min) {
                            continue;
                        }

                        const quantityNum = this.getPrice(quantity);

                        const currentPriceNum = this.getPrice(currentPrice);
                        const isBuy = quantityNum > 0;
                        let countForClose = 0;

                        const avalibleQuantity = Math.abs(quantityNum) - blockedNum;

                        if (avalibleQuantity <= 0) {
                            return;
                        }

                        for (let j = 0; j < SLLen; j++) {
                            const {
                                price,
                                quantity: quantitySl,
                            } = this.TPSLMap?.[instrumentUid]?.SL[j] || {};

                            const slPrice = this.getPrice(price);

                            if (isBuy && slPrice >= currentPriceNum || !isBuy && slPrice <= currentPriceNum) {
                                countForClose += quantitySl || 0;
                                this.TPSLMap[instrumentUid].closed.push({ ...this.TPSLMap[instrumentUid].SL[j] });
                                this.TPSLMap[instrumentUid].SL[j] = undefined;
                            }
                        }

                        if (countForClose > 0) {
                            this.TPSLMap[instrumentUid].SL = this.TPSLMap[instrumentUid].SL.filter(Boolean);

                            const orderData = {
                                accountId,
                                instrumentId: instrumentUid,
                                quantity: (isBuy ? -1 : 1) * Math.min(avalibleQuantity, countForClose),
                                orderType: OrderType.ORDER_TYPE_MARKET,
                                timeInForceType: TimeInForceType.TIME_IN_FORCE_FILL_AND_KILL,
                            };

                            const order = await Bot.order(
                                this.sdk,
                                orderData,
                            );

                            this.TPSLMap[instrumentUid].closedOrders.push(order);

                            return true;
                        }
                    } catch (e) {
                        console.log(e); // eslint-disable-line no-console
                    }
                }
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }

            return false;
        }

        async processing() { // eslint-disable-line
            if (!this.inProgress) {
                await super.processing();

                return;
            }

            const sdk = this.sdk;
            const accountId = this.accountId;

            // profitRange: parseFloat(settings.profitRange * 100),
            // iagreetrade: Boolean(settings.iagreetrade),

            if (!sdk || !accountId) {
                await super.processing();

                return;
            }

            try {
                await this.syncPos();
                await this.updateOrders();

                const isSync = Boolean(this.currentPositions?.every(p =>

                    // @ts-ignore
                    p?.quantity?.units && (p?.quantity?.units - p?.blocked) === p?.balance, // && !p?.blocked,
                ));

                if (!isSync) {
                    await super.processing();

                    return;
                }

                const { positions } = this.currentPortfolio || {};

                if (!positions?.length) {
                    await super.processing();

                    return;
                }

                // Проверить если цена перешла планку SL, то закрыть .

                const someClosed = await this.closeBySL({
                    accountId,
                    positions,
                });

                if (someClosed) {
                    await super.processing();

                    return;
                }

                // Проверить, если цена пошла в сторону TP, то подвинуть TP и SL

                // + 1. Закрытие заявки по SL
                // 2. Если цена растёт в профите, то SL обновляем
                // 3. Если цена падает в профите, то закрываем по SL и цену не двигаем
                // 4. При обновлении цены SL не повышаем при изменениях ниже 0.2%
                // 5. При увеличении профита сдвигаем заявки в стакане по TP
                // 6. При уменьшении профита заявки в стакане не трогаем
                // 7. Проверяем наличие заявок по TP. Если заявок нет, то нужно удалить из карты.

                // 8. Хранить карту в БД и восстанавливать при перезапусках (?)

                // 9. Карта закрытых сделок по TP и SL
                // 10. Карта позиций и матчинг на закрытые сделки, чтобы понятен был профит и комиссия.

                await this.createMaps({
                    accountId,
                    positions,
                });

                // const { stopOrders } = await sdk.stopOrders.getStopOrders({
                //     accountId,
                //     status: StopOrderStatusOption.STOP_ORDER_STATUS_ACTIVE,
                // });

                for (let j = 0; j < positions.length; j++) {
                    const {
                        // instrumentType,
                        // quantity,
                        averagePositionPrice,
                        instrumentUid,

                        // currentPrice,

                        // blocked,
                    } = positions[j];

                    const curPos: {
                        blocked?: number | boolean;
                        quantity?: Quotation;
                        balance?: number;
                    } = this.currentPositions?.find(
                        (p: { instrumentUid: 'string'; },

                        ) => p.instrumentUid === instrumentUid) || {};

                    const {
                        blocked,
                        balance,
                    } = curPos;

                    const quantityPos = curPos?.quantity;

                    if (quantityPos?.units && quantityPos?.units !== balance || blocked) {
                        continue;
                    }

                    // const isShort = (this.getPrice(quantity) || 0) < 0;
                    const instrumentInOrders = this.currentOrders?.find(o => o.instrumentUid === instrumentUid);

                    if (
                        // instrumentType !== 'share' ||
                        !averagePositionPrice ||
                        !this.allInstrumentsInfo?.[instrumentUid]?.lot ||

                        // Если по инструменту выставлена активная заявка, то стоп не ставим.
                        instrumentInOrders
                    ) {
                        // здесь добавить, что если цена проскочила заявку, то заявку закрыть.
                        continue;
                    }

                    if (this.hasBlockedPositions(instrumentUid)) {
                        this.decisionBuyPositionMessage = 'decisionBuy: есть блокированные позиции.';

                        await super.processing();

                        return;
                    }

                    const averagePositionPriceVal = Common.getPrice(averagePositionPrice);

                    if (!averagePositionPrice || !averagePositionPriceVal ||
                        !this.allInstrumentsInfo[instrumentUid]?.lot) {
                        continue;
                    }

                    //     const currentStopOrder = stopOrders.find(s => s.instrumentUid === instrumentUid);
                    //     const stopOrdersLotsDiff = Math.abs(currentStopOrder?.lotsRequested || 0) !==
                    //         Math.abs((Common.getPrice(quantity) || 1) / this.allInstrumentsInfo[instrumentUid].lot);

                    const min = this.allInstrumentsInfo[instrumentUid].minPriceIncrement;

                    if (!min) {
                        continue;
                    }

                    //     const {
                    //         breakeven,
                    //     } = isShort ?
                    //         this.getStopProfitForShort(averagePositionPriceVal) :
                    //         this.getStopProfitForLong(averagePositionPriceVal);

                    //     const realStop = this.getRealStop(isShort, breakeven, min);

                    // const curPrice = Common.getPrice(currentPrice) || 0;

                    //     if (realStop &&
                    //         (

                    //             // (isShort && (curPrice * 1.0005) <= realStop) ||
                    //             // (!isShort && (curPrice * 0.9995) >= realStop)
                    //             (isShort && (curPrice) <= realStop) ||
                    //             (!isShort && (curPrice) >= realStop)
                    //         )
                    //     ) {
                    //         const p = this.getStopPriceWithSteps(isShort, curPrice, breakeven, averagePositionPriceVal);

                    //         const units = Math.floor(p);
                    //         const nano = p * 1e9 - Math.floor(p) * 1e9;

                    //         const newUnits1 = Common.getMinPriceIncrement(units, min.units);
                    //         const newNano1 = Common.getMinPriceIncrement(nano, min.nano);

                    //         const curStopOrderPrice = Common.resolveMinPriceIncrement({
                    //             units: newUnits1,
                    //             nano: newNano1,
                    //         }, min);

                    //         // API не умеет работать с неполными лотами. Поэтому округляем в меньшую сторону.
                    //         const quantSize = Math.floor(
                    //             Math.abs(
                    //                 (quantity?.units || 0) /
                    //                 this.allInstrumentsInfo[instrumentUid].lot,
                    //             ),
                    //         );

                    //         if (!quantSize) {
                    //             await super.processing();

                    //             return;
                    //         }

                    //         const price = Common.resolveMinPriceIncrement(Common.getQuotationFromPrice(realStop), min);
                    //         const stopPrice = Common.resolveMinPriceIncrement(isShort ?
                    //             Common.subMinPriceIncrement(curStopOrderPrice, min) :
                    //             Common.addMinPriceIncrement(curStopOrderPrice, min), min);

                    //         const data = {
                    //             quantity: quantSize,
                    //             price,
                    //             stopPrice,
                    //             direction: isShort ?
                    //                 StopOrderDirection.STOP_ORDER_DIRECTION_BUY :
                    //                 StopOrderDirection.STOP_ORDER_DIRECTION_SELL,
                    //             expirationType: StopOrderExpirationType.STOP_ORDER_EXPIRATION_TYPE_GOOD_TILL_CANCEL,
                    //             stopOrderType: StopOrderType.STOP_ORDER_TYPE_STOP_LIMIT,
                    //             instrumentId: instrumentUid,
                    //             accountId,
                    //         };

                    //         const existOrderStopPrice = Common.getPrice(currentStopOrder?.price) || 0;
                    //         const curStopOrderPriceNum = Common.getPrice(curStopOrderPrice) || 0;

                    //         if (
                    //             !currentStopOrder ||
                    //             stopOrdersLotsDiff ||
                    //             (
                    //                 isShort && (existOrderStopPrice > curStopOrderPriceNum) ||
                    //                 !isShort && (existOrderStopPrice < curStopOrderPriceNum)
                    //             )
                    //         ) {
                    //             if (currentStopOrder?.stopOrderId) {
                    //                 const { stopOrderId } = currentStopOrder;

                    //                 await this.closeStopOrder(accountId, stopOrderId);
                    //             }

                    //             console.log('Открываем заявку', curStopOrderPriceNum, price, stopPrice); // eslint-disable-line no-console
                    //             await sdk.stopOrders.postStopOrder(data);
                    //         }
                    //     } else if (currentStopOrder?.stopOrderId) {
                    //         const { stopOrderId } = currentStopOrder;

                    //         await this.closeStopOrder(accountId, stopOrderId);
                    //     }
                }
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }

            await super.processing();
        }

        // getStopPriceWithSteps(
        //     isShort: boolean,
        //     curPrice: number,
        //     breakeven: number,
        //     averagePositionPriceVal: number,
        // ) {
        //     const {
        //         step1,
        //         step2,
        //         step3,
        //         step4,
        //     } = isShort ?
        //         this.getStopProfitForShort(averagePositionPriceVal) :
        //         this.getStopProfitForLong(averagePositionPriceVal);

        //     if (isShort) {
        //         return curPrice < step4 ?
        //             (step3 + step4 + curPrice) / 3 :
        //             curPrice < step3 ?
        //                 (step3 + step2) / 2 :
        //                 curPrice < step2 ?
        //                     (step2 + step1) / 2 :
        //                     curPrice < step1 ?
        //                         (breakeven + step1) / 2 :
        //                         breakeven;
        //     }

        //     return curPrice > step4 ?
        //         (step3 + step4 + curPrice) / 3 :
        //         curPrice > step3 ?
        //             (step3 + step2) / 2 :
        //             curPrice > step2 ?
        //                 (step2 + step1) / 2 :
        //                 curPrice > step1 ?
        //                     (breakeven + step1) / 2 :
        //                     breakeven;
        // }

        // /**
        //  * При рассчётах бывает, что после округления цена закрытия становится меньше, чем цена реального безубытка.
        //  * Поэтому добавляем или вычитаем один минимальный шаг цены, для получения точного значения безубытка.
        //  *
        //  * @param isShort
        //  * @param breakeven
        //  * @param min
        //  * @returns
        //  */
        getRealStop(isShort: boolean, breakeven: number, min: Quotation) {
            const units = Math.floor(breakeven);
            const nano = breakeven * 1e9 - Math.floor(breakeven) * 1e9;

            const stopPUnits = Common.getMinPriceIncrement(units, min.units);
            const stopPNano = Common.getMinPriceIncrement(nano, min.nano);

            return isShort ?
                Common.getPrice(
                    Common.subMinPriceIncrement(
                        Common.resolveMinPriceIncrement({
                            units: stopPUnits,
                            nano: stopPNano,
                        }, min), min),
                ) :
                Common.getPrice(
                    Common.addMinPriceIncrement(
                        Common.resolveMinPriceIncrement({
                            units: stopPUnits,
                            nano: stopPNano,
                        }, min), min),
                );
        }

        getTPPoint(price: number, isShort: boolean, breakeven: number, min: Quotation) {
            if (isShort) {
                return this.getRealStop(true, price * (1 - breakeven), min);
            }

            return this.getRealStop(false, price * (1 + breakeven), min);
        }

        getSLPoint(price: number, isShort: boolean, breakeven: number, min: Quotation) {
            if (isShort) {
                return this.getRealStop(false, price * (1 + breakeven), min);
            }

            return this.getRealStop(true, price * (1 - breakeven), min);
        }

        // getStopProfitForLong(price: number) {
        //     this.getCurrentSettings();

        //     return {
        //         breakeven: price * (1 + this.breakeven),
        //         step1: price * (1 + this.breakevenStep1),
        //         step2: price * (1 + this.breakevenStep2),
        //         step3: price * (1 + this.breakevenStep3),
        //         step4: price * (1 + this.breakevenStep4),
        //     };
        // }

        // getStopProfitForShort(price: number) {
        //     this.getCurrentSettings();

        //     return {
        //         breakeven: price * (1 - this.breakeven),
        //         step1: price * (1 - this.breakevenStep1),
        //         step2: price * (1 - this.breakevenStep2),
        //         step3: price * (1 - this.breakevenStep3),
        //         step4: price * (1 - this.breakevenStep4),
        //     };
        // }

        // async closeStopOrder(accountId: string, stopOrderId: string) {
        //     await this.sdk?.stopOrders.cancelStopOrder({
        //         accountId,
        //         stopOrderId,
        //     });
        // }

        async onTradeData(data: OrderStateStreamResponse_OrderState) { // eslint-disable-line camelcase
            try {
                const {
                    direction,
                    instrumentUid,
                    trades,
                } = data;

                await this.syncPos();

                trades.forEach(t => {
                    try {
                        const {
                            price,
                            quantity,
                        } = t;

                        const {
                            // @ts-ignore
                            quantity: quantityPositionBase,

                            // @ts-ignore
                            averagePositionPriceFifo,
                        } = this.currentPositions.find(
                            (p: { instrumentUid: string; },

                            ) => p.instrumentUid === instrumentUid) || {};

                        const quantityPos = this.roundPrice(quantityPositionBase);
                        const posPrice = this.roundPrice(averagePositionPriceFifo);

                        const isBuyPos = quantityPos > 0;
                        const isBuyOrder = direction === OrderDirection.ORDER_DIRECTION_BUY;

                        const isCloseTrade = isBuyOrder && !isBuyPos ||
                            !isBuyOrder && isBuyPos;

                        const orderPrice = this.roundPrice(price);

                        if (posPrice && isCloseTrade) {
                            const currentYieldSign = !isBuyOrder ? // Закрытие long
                                orderPrice >= posPrice ? 1 : -1 :
                                orderPrice <= posPrice ? 1 : -1;

                            const currentPriceYield = currentYieldSign * Math.abs(this.roundPrice(price) - posPrice);
                            const currentYield = currentYieldSign * Math.abs(currentPriceYield / posPrice) * 100;

                            if (currentYield) {
                                this.TPSLMap[instrumentUid].profit += currentPriceYield * quantity;
                                this.TPSLMap[instrumentUid].profitYield += currentYield;
                            }
                        }
                    } catch (e) {
                        console.log(e); // eslint-disable-line
                    }
                });
            } catch (e) {
                console.log(e); // eslint-disable-line
            }
        }

        start() {
            try {
                super.start();

                this.onTradeDataBinded = this.onTradeData.bind(this);
                this.eventEmitter.on('subscribe:orderTrades:' + this.accountId, this.onTradeDataBinded);
            } catch (e) {
                console.log(e); // eslint-disable-line
            }
        }

        cancelTPSLMapOrders() {
            return new Promise<void>(async resolve => {
                try {
                    const keys = Object.keys(this.TPSLMap || {});

                    for (let i = 0; i < keys.length; i++) {
                        if (this.TPSLMap[keys[i]].fastTP) {
                            for (let j = 0; j < this.TPSLMap[keys[i]].fastTP?.length; j++) {
                                const order = this.TPSLMap[keys[i]].fastTP[j]?.order;

                                if (order) {
                                    await this.cancelOrder(order.orderId);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.log(e); // eslint-disable-line
                }

                return resolve();
            });
        }

        stop() {
            try {
                this.eventEmitter.off('subscribe:orderTrades:' + this.accountId, this.onTradeDataBinded);

                try {
                    const p = this.cancelTPSLMapOrders();

                    return p.then(() => {
                        return super.stop();
                    });
                } catch (e) {
                    console.log(e); // eslint-disable-line
                    super.stop();
                }
            } catch (e) {
                console.log(e); // eslint-disable-line
            }

            return undefined;
        }
    }

    if (name) {
        module.exports[name] = Bot;
    }
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
