// const { throws } = require('assert');
// const { parse } = require('path');

import { Quotation } from 'tinkoff-sdk-grpc-js/dist/generated/common';

// import { StopOrderStatusOption, StopOrderDirection, StopOrderExpirationType, StopOrderType } from 'tinkoff-sdk-grpc-js/dist/generated/stoporders';
import { Common } from '../Common/TsCommon';
import { Share } from 'tinkoff-sdk-grpc-js/dist/generated/instruments';

// @ts-ignore
import { StaticExample } from '../StaticExample';
import { PortfolioPosition } from 'tinkoff-sdk-grpc-js/dist/generated/operations';

// import { InstrumentStatus } from "tinkoff-sdk-grpc-js/dist/generated/instruments";

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

        TRequests: any;

        SLMap!: any;
        TPMap!: any;
        FastTPMap!: any;

        decisionBuyPositionMessage!: string;
        decisionClosePositionMessage!: string | number;
        allInstrumentsInfo: {
            [key: string]: Share
        } = {};

        // @ts-ignore
        constructor(...args) {
            // @ts-ignore
            super(...args);

            this.type = Bot.type;
            this.isPortfolio = false;
            this.name = name;
        }

        async syncSLMap() {
            try {
                if (this.SLMap) {
                    return;
                }
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }
        }

        async syncTPMap() {
            try {
                if (this.TPMap) {
                    return;
                }

                this.TPMap = {};
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }
        }

        async syncFastTPMapMap() {
            try {
                if (this.FastTPMap) {
                    return;
                }

                this.FastTPMap = {};
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }
        }

        async createMaps(props: { accountId: string; positions: PortfolioPosition[]; }) {
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
                    } = positions[i];

                    if (instrumentType !== 'share') {
                        continue;
                    }

                    const averagePositionPriceVal = Common.getPrice(averagePositionPrice);
                    const {
                        lot,
                        minPriceIncrement: min,
                        ticker,
                    } = this.allInstrumentsInfo?.[instrumentUid] || {};

                    if (!averagePositionPrice || !averagePositionPriceVal ||
                        !lot || !min) {
                        continue;
                    }

                    if (!['e6123145-9665-43e0-8413-cd61b8aa9b13', '2c69924a-fcf4-4d3c-8c02-02cd665f554d'].includes(instrumentUid)) {
                        continue;
                    }

                    const instrumentInOrders = this.currentOrders.find(o => o.instrumentUid === instrumentUid);

                    if (instrumentInOrders) {
                        console.log(1);
                    }

                    // console.log('instrumentInOrders', instrumentInOrders);
                    // console.log('positions', accountId, positions[i]);
                    // console.log(averagePositionPrice, averagePositionPriceVal, this.allInstrumentsInfo[instrumentUid]?.lot);

                    const quantityNum = this.getPrice(quantity);

                    // console.log('quantityNum', quantityNum);
                    // console.log('lot', lot);

                    // console.log('iagreetrade', this.iagreetrade);
                    // console.log('profitRange', this.profitRange);

                    // console.log('sl', this.stopLoss);
                    // console.log('tp', this.takeProfit);

                    const currentPriceNum = this.getPrice(currentPrice);
                    const isBuy = quantityNum > 0;

                    const buyPoint = this.getTPPoint(currentPriceNum, !isBuy, this.takeProfit, min);
                    const sellPoint = this.getSLPoint(currentPriceNum, !isBuy, this.stopLoss, min);
                    const medianBase = Math.max(quantityNum * 0.005, 1);

                    console.log(ticker, quantityNum, averagePositionPriceVal, currentPriceNum, this.takeProfit, this.stopLoss);

                    const orderDataTakeProfit = await StaticExample.getSpreadOrderMapByOrderBook(this.sdk,
                        this.TRequests,
                        {
                            accountId,
                            instrumentId: instrumentUid,
                            quantity: Math.floor(quantityNum / lot),
                            minPrice: buyPoint,
                            maxPrice: sellPoint,

                            medianBase,
                            priceFrom: 260,
                            priceTo: 290,
                        });

                    const orderDataStopLoss = await StaticExample.getSpreadOrderMapByOrderBook(this.sdk,
                        this.TRequests,
                        {
                            accountId,
                            instrumentId: instrumentUid,
                            quantity: -1 * Math.floor(quantityNum / lot),
                            minPrice: buyPoint,
                            maxPrice: sellPoint,
                            medianBase,
                            priceFrom: 260,
                            priceTo: 290,
                        });

                    if (0) {
                        console.log('orderData BUY', orderDataTakeProfit);
                        console.log('orderData SELL', orderDataStopLoss);
                    }

                    console.log('getTPPoint', this.getTPPoint(currentPriceNum, !isBuy, this.takeProfit, min));
                    console.log('getSLPoint', this.getSLPoint(currentPriceNum, !isBuy, this.stopLoss, min));

                    await this.syncTPMap();
                    await this.syncSLMap();
                    await this.syncFastTPMapMap();
                }
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }
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

                // const isSync = Boolean(this.currentPositions?.every(p =>

                //     // @ts-ignore
                //     p?.quantity?.units && p?.quantity?.units === p?.balance, // && !p?.blocked,
                // ));

                // if (!isSync) {
                //     console.log(this.currentPositions);
                //     return;
                // }

                const { positions } = this.currentPortfolio || {};

                if (!positions?.length) {
                    await super.processing();

                    return;
                }

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
                    const instrumentInOrders = this.currentOrders.find(o => o.instrumentUid === instrumentUid);

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
    }

    if (name) {
        module.exports[name] = Bot;
    }
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
