// const { throws } = require('assert');
// const { parse } = require('path');

// import { Quotation } from "tinkoff-sdk-grpc-js/dist/generated/common";
import { StopOrderStatusOption, StopOrderDirection, StopOrderExpirationType, StopOrderType } from 'tinkoff-sdk-grpc-js/dist/generated/stoporders';
import { Common } from '../Common/TsCommon';
import { Quotation } from 'tinkoff-sdk-grpc-js/dist/generated/common';
import { Share } from 'tinkoff-sdk-grpc-js/dist/generated/instruments';

// import { InstrumentStatus } from "tinkoff-sdk-grpc-js/dist/generated/instruments";

try {
    const path = require('path');
    const name = __dirname.split(path.sep).pop();

    /**
     * Заготовка торгового робота.
     */
    class Bot extends Common {
        // instrument — торгует одним инструментом. portfolio — всем портфелем.
        static type = 'autoprofit';
        name: string | undefined;

        decisionBuyPositionMessage!: string;
        decisionClosePositionMessage!: string | number;
        allInstrumentsInfo: {
            [key: string]: Share
        } = {};
        breakeven: number = 0.0011;
        breakevenStep1: number = 0.002;
        breakevenStep2: number = 0.005;
        breakevenStep3: number = 0.0075;
        breakevenStep4: number = 0.0095;

        // @ts-ignore
        constructor(...args) {
            // @ts-ignore
            super(...args);

            this.type = Bot.type;
            this.isPortfolio = false;
            this.name = name;
        }

        async processing() { // eslint-disable-line
            if (!this.inProgress) {
                await super.processing();

                return;
            }

            const sdk = this.sdk;
            const accountId = this.accountId;

            if (!sdk || !accountId) {
                await super.processing();

                return;
            }

            try {
                await this.syncPos();

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

                const { stopOrders } = await sdk.stopOrders.getStopOrders({
                    accountId,
                    status: StopOrderStatusOption.STOP_ORDER_STATUS_ACTIVE,
                });

                await this.updateOrders();

                for (let j = 0; j < positions.length; j++) {
                    const {
                        // instrumentType,
                        quantity,
                        averagePositionPrice,
                        instrumentUid,
                        currentPrice,

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

                    const isShort = (this.getPrice(quantity) || 0) < 0;

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

                    const currentStopOrder = stopOrders.find(s => s.instrumentUid === instrumentUid);
                    const stopOrdersLotsDiff = Math.abs(currentStopOrder?.lotsRequested || 0) !==
                        Math.abs((Common.getPrice(quantity) || 1) / this.allInstrumentsInfo[instrumentUid].lot);

                    const min = this.allInstrumentsInfo[instrumentUid].minPriceIncrement;

                    if (!min) {
                        continue;
                    }

                    const {
                        breakeven,
                    } = isShort ?
                        this.getStopProfitForShort(averagePositionPriceVal) :
                        this.getStopProfitForLong(averagePositionPriceVal);

                    const realStop = this.getRealStop(isShort, breakeven, min);

                    const curPrice = Common.getPrice(currentPrice) || 0;

                    if (realStop &&
                        (

                            // (isShort && (curPrice * 1.0005) <= realStop) ||
                            // (!isShort && (curPrice * 0.9995) >= realStop)
                            (isShort && (curPrice) <= realStop) ||
                            (!isShort && (curPrice) >= realStop)
                        )
                    ) {
                        const p = this.getStopPriceWithSteps(isShort, curPrice, breakeven, averagePositionPriceVal);

                        const units = Math.floor(p);
                        const nano = p * 1e9 - Math.floor(p) * 1e9;

                        const newUnits1 = Common.getMinPriceIncrement(units, min.units);
                        const newNano1 = Common.getMinPriceIncrement(nano, min.nano);

                        const curStopOrderPrice = Common.resolveMinPriceIncrement({
                            units: newUnits1,
                            nano: newNano1,
                        }, min);

                        // API не умеет работать с неполными лотами. Поэтому округляем в меньшую сторону.
                        const quantSize = Math.floor(
                            Math.abs(
                                (quantity?.units || 0) /
                                this.allInstrumentsInfo[instrumentUid].lot,
                            ),
                        );

                        if (!quantSize) {
                            await super.processing();

                            return;
                        }

                        const data = {
                            quantity: quantSize,
                            price: Common.getQuotationFromPrice(realStop), // curStopOrderPrice,
                            stopPrice:
                                isShort ?
                                    Common.subMinPriceIncrement(curStopOrderPrice, min) :
                                    Common.addMinPriceIncrement(curStopOrderPrice, min),
                            direction: isShort ?
                                StopOrderDirection.STOP_ORDER_DIRECTION_BUY :
                                StopOrderDirection.STOP_ORDER_DIRECTION_SELL,
                            expirationType: StopOrderExpirationType.STOP_ORDER_EXPIRATION_TYPE_GOOD_TILL_CANCEL,
                            stopOrderType: StopOrderType.STOP_ORDER_TYPE_STOP_LIMIT,
                            instrumentId: instrumentUid,
                            accountId,
                        };

                        const existOrderStopPrice = Common.getPrice(currentStopOrder?.price) || 0;
                        const curStopOrderPriceNum = Common.getPrice(curStopOrderPrice) || 0;

                        if (
                            !currentStopOrder ||
                            stopOrdersLotsDiff ||
                            (
                                isShort && (existOrderStopPrice > curStopOrderPriceNum) ||
                                !isShort && (existOrderStopPrice < curStopOrderPriceNum)
                            )
                        ) {
                            if (currentStopOrder?.stopOrderId) {
                                const { stopOrderId } = currentStopOrder;

                                await this.closeStopOrder(accountId, stopOrderId);
                            }

                            console.log('Открываем заявку', curStopOrderPriceNum); // eslint-disable-line no-console
                            await sdk.stopOrders.postStopOrder(data);
                        }
                    } else if (currentStopOrder?.stopOrderId) {
                        const { stopOrderId } = currentStopOrder;

                        await this.closeStopOrder(accountId, stopOrderId);
                    }
                }
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }

            await super.processing();
        }

        getStopPriceWithSteps(
            isShort: boolean,
            curPrice: number,
            breakeven: number,
            averagePositionPriceVal: number,
        ) {
            const {
                step1,
                step2,
                step3,
                step4,
            } = isShort ?
                this.getStopProfitForShort(averagePositionPriceVal) :
                this.getStopProfitForLong(averagePositionPriceVal);

            if (isShort) {
                return curPrice < step4 ?
                    (step3 + step4 + curPrice) / 3 :
                    curPrice < step3 ?
                        (step3 + step2) / 2 :
                        curPrice < step2 ?
                            (step2 + step1) / 2 :
                            curPrice < step1 ?
                                (breakeven + step1) / 2 :
                                breakeven;
            }

            return curPrice > step4 ?
                (step3 + step4 + curPrice) / 3 :
                curPrice > step3 ?
                    (step3 + step2) / 2 :
                    curPrice > step2 ?
                        (step2 + step1) / 2 :
                        curPrice > step1 ?
                            (breakeven + step1) / 2 :
                            breakeven;
        }

        /**
         * При рассчётах бывает, что после округления цена закрытия становится меньше, чем цена реального безубытка.
         * Поэтому добавляем или вычитаем один минимальный шаг цены, для получения точного значения безубытка.
         *
         * @param isShort
         * @param breakeven
         * @param min
         * @returns
         */
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

        getStopProfitForLong(price: number) {
            this.getCurrentSettings();

            return {
                breakeven: price * (1 + this.breakeven),
                step1: price * (1 + this.breakevenStep1),
                step2: price * (1 + this.breakevenStep2),
                step3: price * (1 + this.breakevenStep3),
                step4: price * (1 + this.breakevenStep4),
            };
        }

        getStopProfitForShort(price: number) {
            this.getCurrentSettings();

            return {
                breakeven: price * (1 - this.breakeven),
                step1: price * (1 - this.breakevenStep1),
                step2: price * (1 - this.breakevenStep2),
                step3: price * (1 - this.breakevenStep3),
                step4: price * (1 - this.breakevenStep4),
            };
        }

        async closeStopOrder(accountId: string, stopOrderId: string) {
            await this.sdk?.stopOrders.cancelStopOrder({
                accountId,
                stopOrderId,
            });
        }
    }
    if (name) {
        module.exports[name] = Bot;
    }
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
