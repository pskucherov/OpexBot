// @ts-ignore
import { Backtest } from '../../src/Common/Backtest';
import {HistoricCandle} from "tinkoff-sdk-grpc-js/src/generated/marketdata";
import {RSI} from "../../components/indicator/RSI";
import {MA} from "../../components/indicator/MA";
import {Common} from '../../src/Common/Common';

export class Robot
{
    backtest: Backtest;

    candles: HistoricCandle[] = [];
    currentCandle?: HistoricCandle = undefined;
    currentPrice: number = 0;
    priceToClosePosition: number = 0;
    PRICE_DIFF: number = 2;
    LOTS: number = 1;

    RSI: number = 0;
    PERIOD_RSI: number = 30;

    MA: number = 0;
    PERIOD_MA: number = 200;


    constructor(backtest: Backtest) {
        this.backtest = backtest;
    }

    async initStep(currentCandle: HistoricCandle) {
        this.candles.push(currentCandle);
        this.currentCandle = currentCandle;
        this.currentPrice = Common.getPrice(currentCandle.close);

        if (this.candles.length > this.PERIOD_RSI && this.candles.length > this.PERIOD_MA) {
            this.RSI = await RSI.calculate(this.candles.slice(-this.PERIOD_RSI - 1), this.PERIOD_RSI) || 0;
            this.MA = await MA.calculate(this.candles.slice(-this.PERIOD_MA - 1), this.PERIOD_MA, 'MA') || 0;
        }
    }

    makeStep() {
        if (this.needBuy()) {
            this.makeBuy();
        } else if (this.needSell()) {
            this.makeSell();
        } else if (this.needCloseBuy() || this.needCloseSell()) {
            let lots = 0;
            this.backtest.getOpenedPositions().forEach(position => lots += position.lots);
            this.backtest.backtestClosePosition(this.currentPrice);
            this.consolePositionMessage(this.backtest.getLastPosition());
        }
    }

    makeBuy() {
        if (!this.backtest.hasBacktestOpenPositions()) {
            this.priceToClosePosition = (this.currentPrice + this.MA) / 2;
        } else {
            let lots = 0;
            let sumPrice = 0;
            this.backtest.getOpenedPositions().forEach(position => {
                sumPrice += Common.getPrice(position.price) * position.lots;
                lots += position.lots;
            })
            const avgPrice = sumPrice / lots;
            this.priceToClosePosition = (avgPrice + this.MA) / 2;
        }

        this.backtest.backtestBuy(this.currentPrice, this.LOTS, this.currentCandle?.time);
        this.consolePositionMessage(this.backtest.getLastOpenedPosition());
    }

    makeSell() {
        if (!this.backtest.hasBacktestOpenPositions()) {
            this.priceToClosePosition = (this.currentPrice + this.MA) / 2;
        } else {
            let lots = 0;
            let sumPrice = 0;
            this.backtest.getOpenedPositions().forEach(position => {
                sumPrice += Common.getPrice(position.price) * position.lots;
                lots += position.lots;
            })
            const avgPrice = sumPrice / lots;
            this.priceToClosePosition = (avgPrice + this.MA) / 2;
        }

        this.backtest.backtestSell(this.currentPrice, this.LOTS, this.currentCandle?.time);
        this.consolePositionMessage(this.backtest.getLastOpenedPosition());
    }

    needBuy() {
        const hasOpenedPosition = this.backtest.hasBacktestOpenPositions();
        const hasPriceDiff = this.calcPercentDiff(this.currentPrice, this.MA) < -this.PRICE_DIFF;
        const hasLowRSI = this.RSI < 30;

        return hasPriceDiff && hasLowRSI && (
                !hasOpenedPosition
                || (
                    this.hasTimeDiff(30)
                    && this.calcPercentDiff(this.currentPrice, Common.getPrice(this.backtest.getLastOpenedPosition().price)) < -this.PRICE_DIFF
                )
            );
    }

    needSell() {
        const hasOpenedPosition = this.backtest.hasBacktestOpenPositions();
        const hasPriceDiff = this.calcPercentDiff(this.currentPrice, this.MA) > this.PRICE_DIFF;
        const hasHighRSI = this.RSI > 70;

        return hasPriceDiff && hasHighRSI && (
            !hasOpenedPosition
            || (
                this.hasTimeDiff(30)
                && this.calcPercentDiff(this.currentPrice, Common.getPrice(this.backtest.getLastOpenedPosition().price)) > this.PRICE_DIFF
            )
        );
    }

    needCloseBuy() {
        const hasOpenedPosition = this.backtest.hasBacktestOpenPositions();
        const isOpenedBuy = hasOpenedPosition && this.backtest.getLastOpenedPosition().direction === 1;
        return isOpenedBuy
            && (
                this.currentPrice >= this.priceToClosePosition
                || this.MA < this.priceToClosePosition
            );
    }

    needCloseSell() {
        const hasOpenedPosition = this.backtest.hasBacktestOpenPositions();
        const isOpenedSell = hasOpenedPosition && this.backtest.getLastOpenedPosition().direction === 2;

        return isOpenedSell
            && (
                this.currentPrice <= this.priceToClosePosition
                || this.MA > this.priceToClosePosition
            );
    }

    hasTimeDiff(minutes: number) {
        return this.currentCandle?.time
            && this.currentCandle?.time?.getTime() - this.backtest.getLastOpenedPosition().time.getTime() > minutes * 60 * 1000;
    }

    calcPercentDiff(partial: number, total: number) {
        return (partial * 100) / total - 100;
    }

    printResult() {
        let result = 0;
        this.backtest.getBacktestPositions()?.forEach(position => {
            if (position.direction == 1) {
                result -= Common.getPrice(position.price) * position.lots;
            } else if (position.direction == 2) {
                result += Common.getPrice(position.price) * position.lots;
            }
        })

        console.log(result.toFixed(2));
    }

    consolePositionMessage(position: any) {
        const positionType = position.direction === 1 ? 'Покупка' : 'Продажа';
        const date = this.currentCandle?.time;
        const rsiStr = this.RSI ? `
RSI: ${this.RSI}` : '';
        const priceToCloseStr = this.priceToClosePosition ? `
Цена закрытия: ${this.priceToClosePosition}` : '';
        console.log(`${positionType}
Цена: ${position.price}
Дата: ${date}${rsiStr}${priceToCloseStr}
`);
    }

}