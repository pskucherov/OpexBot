import { MoneyValue } from 'tinkoff-sdk-grpc-js/dist/generated/common';
import { PortfolioPosition } from 'tinkoff-sdk-grpc-js/dist/generated/operations';
import { OrderDirection } from 'tinkoff-sdk-grpc-js/dist/generated/orders';

const { Common } = require('./Common');

interface IBacktestPositions extends PortfolioPosition {
    id: string;
    parentId: string;
    step: number;
    price: MoneyValue;
    lots: number;
    time?: Date;
    closed: boolean;
    direction: OrderDirection;
}

export class Backtest extends Common {
    backtestPositions: IBacktestPositions[] = [];

    init() {
        super.init();

        this.backtestPositions = [];
        this.backtestOrders = [];
    }

    setBacktestState(step: number,
        interval?: number | undefined,
        instrumentId?: string,
        date?: Date | undefined,
        options?: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    ) {
        interval && (this.interval = interval);
        instrumentId && (this.instrumentId = instrumentId);
        date && (this.date = date);

        if (step && this.step !== step) {
            this.step = step;

            // Для каждого шага вызываем обработчик.
            this.processing();
        }

        if (options && options.tickerInfo) {
            this.tickerInfo = options.tickerInfo;
        }
    }

    getBacktestState() {
        return {
            name: this.name,
            step: this.step,
            interval: this.interval,
            instrumentId: this.instrumentId,
            date: this.date,
        };
    }

    backtestBuy(price: MoneyValue, lots: number, time: Date) {
        this.backtestPositions.push({
            id: this.genOrderId(),
            parentId: '',
            step: this.step,
            price: price,
            averagePositionPrice: price,
            lots: lots || this.lotsSize,
            time: time,
            direction: this.enums.OrderDirection.ORDER_DIRECTION_BUY,
            quantity: {
                units: this.tickerInfo.lot,
                nano: 0,
            },
            closed: false,

            figi: '',
            instrumentType: '',
            expectedYield: undefined,
            currentNkd: undefined,
            averagePositionPricePt: undefined,
            currentPrice: undefined,
            averagePositionPriceFifo: undefined,
            quantityLots: undefined,
            blocked: false,
            blockedLots: undefined,
            positionUid: '',
            instrumentUid: '',
            varMargin: undefined,
            expectedYieldFifo: undefined,
        });
    }

    backtestSell(price: MoneyValue, lots: number, time: Date) {
        this.backtestPositions.push({
            id: this.genOrderId(),
            parentId: '',
            step: this.step,
            price: price,
            averagePositionPrice: price,
            lots: lots || this.lotsSize,
            time: time,
            direction: this.enums.OrderDirection.ORDER_DIRECTION_SELL,
            quantity: {
                units: this.tickerInfo.lot,
                nano: 0,
            },
            closed: false,

            figi: '',
            instrumentType: '',
            expectedYield: undefined,
            currentNkd: undefined,
            averagePositionPricePt: undefined,
            currentPrice: undefined,
            averagePositionPriceFifo: undefined,
            quantityLots: undefined,
            blocked: false,
            blockedLots: undefined,
            positionUid: '',
            instrumentUid: '',
            varMargin: undefined,
            expectedYieldFifo: undefined,
        });
    }

    backtestClosePosition(price: MoneyValue) {
        for (const p of this.getOpenedPositions()) {
            if (!p.closed) {
                p.closed = true;

                this.backtestPositions.push({
                    id: this.genOrderId(),
                    parentId: p.id,
                    step: this.step,
                    price: price,
                    averagePositionPrice: price,
                    lots: p.lots || this.lotsSize,
                    quantity: {
                        units: this.tickerInfo.lot,
                        nano: 0,
                    },
                    direction: p.direction === this.enums.OrderDirection.ORDER_DIRECTION_BUY ?
                        this.enums.OrderDirection.ORDER_DIRECTION_SELL :
                        this.enums.OrderDirection.ORDER_DIRECTION_BUY,
                    expectedYield: {
                        units: price.units - p.price.units,
                        nano: price.nano - p.price.nano,
                    },
                    closed: true,

                    time: undefined,
                    figi: '',
                    instrumentType: '',
                    currentNkd: undefined,
                    averagePositionPricePt: undefined,
                    currentPrice: undefined,
                    averagePositionPriceFifo: undefined,
                    quantityLots: undefined,
                    blocked: false,
                    blockedLots: undefined,
                    positionUid: '',
                    instrumentUid: '',
                    varMargin: undefined,
                    expectedYieldFifo: undefined,
                });
            }
        }
    }

    getBacktestPositions() {
        return this.backtestPositions;
    }

    getBacktestOrders() {
        return this.backtestOrders;
    }

    hasBacktestOpenPositions() {
        for (const p of this.backtestPositions) {
            if (!p.closed) {
                return true;
            }
        }

        return false;
    }

    getOpenedPositions() {
        if (!this.hasBacktestOpenPositions()) {
            return [];
        }

        return this.backtestPositions.filter(position => !position.closed);
    }

    getLastOpenedPosition() {
        if (!this.hasBacktestOpenPositions()) {
            return undefined;
        }

        const openedPositions = this.getOpenedPositions();

        return openedPositions[openedPositions.length - 1];
    }

    getLastPosition() {
        if (!this.backtestPositions.length) {
            return undefined;
        }

        return this.backtestPositions[this.backtestPositions.length - 1];
    }

    stop() {
        super.stop();

        this.backtestPositions = [];
        this.backtestOrders = [];
    }
}
