// @ts-nocheck
/* eslint @typescript-eslint/no-explicit-any: 0 */
/* eslint @typescript-eslint/no-unused-vars: 0 */
/* eslint @typescript-eslint/ban-types: 0 */
/* eslint max-len: 0 */
/* eslint sonarjs/no-duplicate-string: 0 */
import { PortfolioResponse } from 'tinkoff-sdk-grpc-js/dist/generated/operations';

import { createSdk } from 'tinkoff-sdk-grpc-js';
import { MoneyValue, Quotation } from 'tinkoff-sdk-grpc-js/dist/generated/common';

import { mkDirByPathSync } from '../utils';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { OrderDirection, OrderExecutionReportStatus, OrderState, OrderType, TimeInForceType } from 'tinkoff-sdk-grpc-js/dist/generated/orders';
import TelegramBot from 'node-telegram-bot-api';
import { TRequests as TRequestsBase } from '../TRequests/TRequests';
import { Share } from 'tinkoff-sdk-grpc-js/dist/generated/instruments';
import { GetTradingStatusResponse } from 'tinkoff-sdk-grpc-js/dist/generated/marketdata';

export class Common {
    static settingsFileName = 'settings.json';
    accountId: any;
    backtest: boolean;
    enums: {
        OrderDirection: {
            ORDER_DIRECTION_BUY: OrderDirection.ORDER_DIRECTION_BUY,
            ORDER_DIRECTION_SELL: OrderDirection.ORDER_DIRECTION_SELL,
        }
    };
    brokerId: string;
    tgBot: TelegramBot;
    cb: {
        getQuotationsAndOrderbook(instrumentId: any): any;
        getTickerInfo: any;
        getTradingSchedules: any;
        getOrderState: any;
        getOperations: any;
        getPortfolio: any;
        getPositions: any;
        getOrders: any;
        cancelOrder(accountId: any, orderId: any): unknown;
        subscribes: {};

        // TODO: порефакторить количество параметров
        postOrder: () => void; // eslint-disable-line max-params
        cacheState: () => void;
    };
    isSandbox: boolean;
    blueChipsShares: any;
    subscribesTimer!: number;
    robotTimer!: number;
    subscribeDataUpdated!: {};
    orders!: {};
    tradingTime!: boolean;
    tickerInfo: any;
    exchange: any;
    tradingTimeInfo!: string;
    currentTime!: Date;
    startTradingTimeHours: any;
    endTradingTimeHours: any;
    startTradingTimeMinutes: any;
    endTradingTimeMinutes: any;
    tradingDays!: boolean;
    currentOrders: OrderState[];
    ordersInited!: boolean;
    currentPortfolio: PortfolioResponse | undefined;
    currentPositions!: never[];
    inProgress: any;
    isPortfolio: any;
    orderTrades: any;
    instrumentId: any;
    testData: any;
    lastPrice: any;
    candles: any;
    balance: any;
    type: any;
    logOrdersFile: any;
    interval: any;
    date: any;
    lotsSize: any;
    orderType: any;
    takeProfit: any;
    stopLoss: any;
    volume: any;
    support: any;
    resistance: any;
    totalNowSharesAmount: any;
    currentTP: any;
    currentSL: any;
    lastOrderTime!: number;
    allOrders: any;
    static orderIds: any;
    isAdviser: any;
    orderTimeout: any;
    expectedYield: any;
    positionsProfit: any;
    sdk?: ReturnType<typeof createSdk>;

    constructor(accountId: any, _adviser: any, backtest: any, callbacks = { // eslint-disable-line max-params
        subscribes: {},

        // TODO: порефакторить количество параметров
        postOrder: (
            // accountId, instrumentId, quantity, price, direction, orderType, orderId
        ) => { }, // eslint-disable-line max-params
        cacheState: (
            // instrumentId, time, lastPrice, orderBook
        ) => { },
    }, options = {
        enums: {},
        brokerId: '',

        // tgBot,
        // takeProfit: 3,
        // stopLoss: 1,
        // useTrailingStop: true,
    }, sdk?: ReturnType<typeof createSdk>, TRequests?: InstanceType<typeof TRequestsBase>) {
        this.accountId = accountId;
        this.backtest = Boolean(backtest);
        this.enums = options.enums;
        this.brokerId = options.brokerId;
        this.tgBot = options.tgBot as TelegramBot;
        this.sdk = sdk;

        // Методы, с помощью которых робот может общаться с внешним миром.
        this.cb = callbacks;

        // Автоматически переставлять stopLoss и takeProfit при движении цены в нужную сторону.
        // this.useTrailingStop = options.useTrailingStop;

        this.isSandbox = Boolean(options.isSandbox);
        this.blueChipsShares = options.blueChipsShares;

        if (!TRequests) {
            console.trace(); // eslint-disable-line
            throw 'Не задан TRequests для управления лимитами SDK.';
        }
        if (!sdk) {
            throw 'Не задан SDK.';
        }

        this.TRequests = TRequests;
        this.eventEmitter = this.TRequests.getEventEmitter();

        this.getCurrentSettings();

        (async () => {
            this.init();
            this.initAsync();
            this.processing();
        })();

        setInterval(() => {
            this.initAsync();
        }, 15 * 60000);
    }

    init() {
        // Таймер выполнения process
        this.robotTimer = 15000;

        this.orders = {};

        // Устанавливает возможна ли торговля в данный момент.
        // Для бектеста всегда включено.
        this.tradingTime = Boolean(this.backtest);
    }

    /**
     * Проверяет возможность торговли в данный день и время.
     */
    async checkTradingDayAndTime() { // eslint-disable-line
        if (this.backtest) {
            this.tradingTime = true;

            return;
        }

        if (this.brokerId === 'FINAM') {
            // По умолчанию для финам всегда торговый день.
            // И запускать можно только на торги.
            // TODO: сделать переход с одних торгов на другие.
            this.tradingTime = true;

            return;
        }

        if (!this.tickerInfo || !this.exchange || (Array.isArray(this.tickerInfo) && !this.tickerInfo.length)) {
            if (!(await this.hasOpenPositions()) && !(await this.hasOpenOrders())) {
                this.tradingTime = true;
                this.tradingTimeInfo = 'Нет данных про тикер или биржу. Можно пробовать покупать.';

                return;
            }

            this.tradingTime = false;
            this.tradingTimeInfo = 'Нет тикера или данных биржи. Торги остановлены.';

            return;
        }

        this.currentTime = new Date();
        if (this.currentTime.getHours() < this.startTradingTimeHours ||
            this.currentTime.getHours() > this.endTradingTimeHours) {
            this.tradingTime = false;
            this.tradingTimeInfo = 'Не проходит ограничение по часам. Торги остановлены.';

            return;
        }

        if (this.currentTime.getHours() === this.startTradingTimeHours &&
            this.currentTime.getMinutes() < this.startTradingTimeMinutes ||
            this.currentTime.getHours() === this.endTradingTimeHours &&
            this.currentTime.getMinutes() > this.endTradingTimeMinutes) {
            this.tradingTime = false;
            this.tradingTimeInfo = 'Не проходит ограничение по минутам. Торги остановлены.';

            return;
        }

        const dayWeek = [
            0b0000001, // воскресенье
            0b1000000,
            0b0100000,
            0b0010000,
            0b0001000,
            0b0000100,
            0b0000010, // суббота
        ][this.currentTime.getDay()];

        if (this.tradingDays && !(dayWeek & this.tradingDays)) {
            this.tradingTime = false;
            this.tradingTimeInfo = 'Не проходит ограничение по торговым дням. Торги остановлены.';

            return;
        }

        const { isTradingDay, startTime, endTime } = this.exchange;
        const now = new Date().getTime();

        if (!isTradingDay || !startTime || !endTime) {
            this.tradingTime = false;
            this.tradingTimeInfo = 'Нет данных биржи про начало и окончание торгов. Торги остановлены.';
        } else if ((new Date(startTime).getTime()) <= now && (new Date(endTime).getTime() > now)) {
            this.tradingTime = true;
            delete this.tradingTimeInfo;
        } else {
            // console.log(now, new Date().toISOString(), startTime, endTime, (new Date(startTime).getTime()), (new Date(endTime).getTime()), (new Date(startTime).getTime()) - now, new Date(endTime).getTime() - now);
            this.tradingTimeInfo = 'Торги проходят с проверкой на статус инструмента.'; // Торги остановлены по времени биржи. Торги остановлены.';
            this.tradingTime = true;
        }
    }

    async initAsync() {
        await this.updateOrders();
        await this.updatePortfolio();
        await this.updatePositions();
        await this.getAllInstruments();
        await this.getAllTradingStatuses();

        // await this.updateOrdersInLog();
    }

    async getAllTradingStatuses() {
        try {
            const ids = Object.keys(this.allInstrumentsInfo || {});

            if (ids.length) {
                const tradingStatuses: GetTradingStatusResponse[] = (
                    (await this.TRequests.getTradingStatuses(ids)) || {}
                )?.tradingStatuses;

                this.tradingStatuses = tradingStatuses?.reduce((acc, val) => {
                    acc[val.instrumentUid] = val;

                    return acc;
                }, {});
            }
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getAllInstruments(name?: string) {
        this.allInstrumentsInfo = await this.TRequests.getAllInstruments(name);
    }

    async updateOrders() {
        if (this.backtest) {
            return;
        }

        this.currentOrders = await this.getOpenOrders();

        // this.currentPositions = await this.getPositions();
        // await this.updatePortfolio();
        // this.currentOperations = await this.getOperations();

        this.ordersInited = true;
    }

    async updatePortfolio() {
        this.currentPortfolio = await this.getPortfolio();
    }

    async updatePositions() {
        try {
            const p = await this.getPositions();

            if (!p || !p.securities) {
                return [];
            }

            this.currentPositions = ([].concat(p.securities, p.futures, p.options, p.bonds))
                .filter(f => Boolean(f))
                .reduce((prev, cur) => {
                    try {
                        const i = this.currentPortfolio?.positions?.findIndex((f: { instrumentId: any; }) => (f.instrumentId ? f.instrumentId === cur.instrumentId :
                            f.instrumentUid === cur.instrumentUid));

                        if (i === -1) {
                            return prev;
                        }

                        prev.push({
                            ...this.currentPortfolio?.positions?.[i],
                            ...cur,
                        });
                    } catch (e) {
                        console.log(e); // eslint-disable-line no-console
                    }

                    return prev;
                }, []);
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    /**
     *
     * @param {?String} param
     * @returns
     */
    getParams(param: string | number) {
        if (param) {
            return this[param];
        }

        return {
            timer: this.timer,
        };
    }

    timer(time: number | undefined) {
        return new Promise(resolve => setTimeout(resolve, time));
    }

    async restart(timeout = 500) {
        this.stop();
        await this.timer(timeout);
        this.start();
    }

    /**
     * Обновляем instrumentId для портфельного управления.
     */
    async updateInstrumentId() {
        // При портфельном управлении содержимое портфеля может меняться.
        // Это нужно учитывать в подписках на цену.
        if (this.isPortfolio) {
            // await this.updatePortfolio();

            if (this.currentPositions?.length) {
                this.instrumentId = this.currentPositions.map(p => p.instrumentId);
            } else {
                this.instrumentId = [];
            }
        }
    }

    /**
     * Модуль обработки данных.
     * По сути бесконечный цикл, который обрабатывает входящие данные.
     */
    async processing() {
        try {
            if (!this.inProgress && !this.backtest) {
                setImmediate(() => this.processing());

                return;
            }

            // // Если информация по инструментам не получена, то ожидаем.
            // if (!this.allInstrumentsInfo?.length) {
            //     setImmediate(async () => {
            //         await this.timer(this.robotTimer);
            //         this.processing();
            //     });

            //     return;
            // }

            this.getCurrentSettings();

            if (!this.backtest) {
                await this.checkExchangeDay();
                await this.checkTradingDayAndTime();
                await this.getAllTradingStatuses();
            }

            if (this.tradingTime || this.backtest) {
                if (!this.backtest) {
                    await this.updateOrders();
                    await this.updatePositions();
                }

                // Обрабатываем логику только после инициализации статуса.
                if (this.ordersInited || this.backtest) {
                    if (await this.decisionClosePosition()) {
                        console.log('decisionClosePosition'); // eslint-disable-line no-console
                        await this.closePosition(this.lastPrice);
                    } else if (await this.decisionBuy()) {
                        console.log('decisionBuy'); // eslint-disable-line no-console
                        await this.callBuy();
                    } else if (await this.decisionSell()) {
                        console.log('decisionBuy'); // eslint-disable-line no-console
                        await this.callSell();
                    }
                }

                // Записываем новое состояние, только если оно изминилось.
                // if (!this.backtest && this.instrumentId && this.cb.cacheState &&
                //     (this.subscribeDataUpdated.orderbook && this.subscribeDataUpdated.lastPrice)) {
                //     // this.cb.cacheState(this.getFileName(), new Date().getTime(), this.lastPrice, this.orderbook);
                //     this.subscribeDataUpdated.lastPrice = false;
                //     this.subscribeDataUpdated.orderbook = false;
                // }
            } else {
                await this.setExchangesTradingTime();
            }

            // Для бектестирования производится пошаговая обработка сделок,
            // а не рекурсивная.
            if (!this.backtest) {
                setImmediate(async () => {
                    await this.timer(this.robotTimer);
                    this.processing();
                });
            }
        } catch (e) {
            console.log('propcessing', e); // eslint-disable-line no-console
        }
    }
    orderbook(_arg0: any, _arg1: number, _lastPrice: any, _orderbook: any) {
        throw new Error('Method not implemented.');
    }

    /**
     * Модуль принятия решений о покупке.
     * @returns {Boolean}
     */
    decisionBuy(): boolean {
        return false;
    }

    /**
     * Модуль принятия решений о продаже.
     * @returns {Boolean}
     */
    decisionSell(): boolean {
        return false;
    }

    /**
     * Модуль принятия решений о закрытии существующей позиции.
     * @returns {Boolean}
     */
    decisionClosePosition(): boolean {
        return false;
    }

    setControlsCallbacks() {
        // Метод покупки
        // Продажи
        // Выставления заявки
    }

    async setCurrentState(lastPrice: any, candles: any, balance: any, orderbook: (arg0: any, arg1: number, lastPrice: any, orderbook: any) => void, options: { type: string; tickerInfo: any; instrumentId: any; }) {
        try {
            // Текущая цена
            // История свечей
            // История стакана
            // Существующие позиции
            // Существующие заявки
            // Баланс
            // Информация об инструменте

            candles && (this.candles = candles);
            orderbook && (this.orderbook = orderbook);
            lastPrice && (this.lastPrice = lastPrice);
            balance && (this.balance = balance);

            if (options) {
                if (options.type) {
                    this.isPortfolio = options.type === 'portfolio';
                    this.type = options.type;
                }

                if (options.tickerInfo) {
                    this.tickerInfo = options.tickerInfo;

                    // this.tickerInfo.instrumentId && (this.instrumentId = this.tickerInfo.instrumentId);
                    options.instrumentId && (this.instrumentId = options.instrumentId);
                }

                await this.setExchangesTradingTime();
            }

            if (!this.logOrdersFile && this.accountId) {
                this.updateLogOrdersFile();
            }
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    updateLogOrdersFile() {
        const { dir, name } = Common.getLogFileName(this.name, this.accountId,

            // this.getFileName(),
            new Date());

        if (!dir) {
            return;
        }

        mkDirByPathSync(dir);
        this.logOrdersFile = path.join(dir, name);
    }

    // getFileName() {
    //     return this.isPortfolio ? this.type : this.instrumentId;
    // }

    isEmptyTickerInfo() {
        return !this.tickerInfo || Array.isArray(this.tickerInfo) && !this.tickerInfo.length;
    }

    async updateTickerInfo() {
        await this.updateInstrumentId();

        if (this.instrumentId && this.cb.getTickerInfo) {
            this.tickerInfo = await this.cb.getTickerInfo(this.instrumentId);
        }
    }

    async callBuy() { }
    async callSell() { }

    // TODO: !!! проверка для каждого инструмента.
    // Здесь ошибка, т.к. проверяется только для одного из инструментов.
    async setExchangesTradingTime() {
        try {
            const now = new Date().getTime();

            await this.updateTickerInfo();

            if (this.isEmptyTickerInfo()) {
                return;
            }

            const { exchanges } = this.cb.getTradingSchedules &&
                await this.cb.getTradingSchedules(
                    this.tickerInfo.exchange || this.tickerInfo[0].exchange, now, now,
                ) || {};

            // console.log(this.tickerInfo.exchange, this.tickerInfo[0], exchanges);
            // console.log(JSON.stringify(exchanges, null, 4));
            if (exchanges && exchanges.length) {
                const { startTime, endTime, isTradingDay } = exchanges[0] &&
                    exchanges[0].days && exchanges[0].days[0];

                this.exchange = {
                    startTime,
                    endTime,
                    isTradingDay,
                };
            }
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    // TODO: переделать под все акции и разные условия торгов.
    async checkExchangeDay() {
        if (!this.exchange || (this.exchange &&
            (new Date(this.exchange.startTime).getDate()) !== new Date().getDate())) {
            this.updateLogOrdersFile();
            await this.setExchangesTradingTime();
        }
    }

    getCurrentState() {
        return {
            name: this.name,
            interval: this.interval,
            instrumentId: this.instrumentId,
            date: this.date,
            backtest: this.backtest,
            type: this.type,
        };
    }

    static getPrice(quotation?: MoneyValue | Quotation) {
        if (!quotation || typeof quotation !== 'object') {
            return quotation || 0;
        }

        if (quotation.nano) {
            return Number(quotation.units) + Number(quotation.nano / 1e9);
        }

        return quotation.units;
    }

    static getQuotationFromPrice(price: number) {
        const units = Math.floor(price);
        const nano = price * 1e9 - units * 1e9;

        return {
            units,
            nano,
        };
    }

    getPrice(quotation?: MoneyValue | Quotation) {
        return Common.getPrice(quotation);
    }

    getQuotationFromPrice(price: number) {
        return Common.getQuotationFromPrice(price);
    }

    start(instrumentId?: string | string[]) {
        if (this.inProgress) {
            return;
        }

        this.getCurrentSettings();

        if (instrumentId) {
            this.instrumentId = instrumentId;
        }

        this.inProgress = true;

        this.TRequests?.subscribes();
        this.TRequests?.subscribesWithAccount(this.accountId);

        console.log(this.name, this.accountId, 'start'); // eslint-disable-line no-console
    }

    stop() {
        if (this.inProgress) {
            console.log(this.name, this.accountId, 'stop'); // eslint-disable-line no-console
        }

        this.inProgress = false;

        clearInterval(this.intervalId);
    }
    intervalId(_intervalId: any) {
        throw new Error('Method not implemented.');
    }

    async buy(price: any, instrumentId: any, lotsSize: any, type: any) {
        try {
            if ((!this.instrumentId && !instrumentId) || !this.accountId) {
                return;
            }

            if (this.backtest) {
                return this.backtestBuy(price || this.lastPrice, lotsSize || this.lotsSize);
            }

            console.log('buy', type || '', lotsSize); // eslint-disable-line no-console

            const order = this.cb.postOrder && (await this.cb.postOrder(
                this.accountId,
                instrumentId || this.instrumentId,
                lotsSize || this.lotsSize,
                price || this.lastPrice, // структура из units и nano
                this.enums.OrderDirection.ORDER_DIRECTION_BUY,
                this.orderType || this.enums.OrderType.ORDER_TYPE_LIMIT,
                this.genOrderId(),
            ));

            order && this.logOrders && this.logOrders(order, type);

            await this.updateOrders();
            this.setLastOrderTime();
        } catch (e) {
            console.log('buy', e); // eslint-disable-line no-console
        }
    }

    backtestBuy(_price: MoneyValue | Quotation | undefined, _lots: number, _time: Date) {
        throw new Error('Method not implemented.');
    }

    getPositionsByInstrumentId(instrumentId: any) {
        if (!instrumentId) {
            return;
        }

        return this.currentPositions?.find(p => p.instrumentId === instrumentId);
    }

    async updateOrdersInLog() {
        const orders = this.getOrdersFromFile();
        let isChanged = false;

        if (this.cb.getOrderState) {
            await Promise.all(orders.map(async (o: { orderId: any; executionReportStatus: number; }, k: string | number) => {
                if (o.orderId && [1, 4, 5].includes(o.executionReportStatus)) {
                    isChanged = true;
                    const newO = await this.cb.getOrderState(this.accountId, o.orderId);

                    if (newO) {
                        orders[k] = {
                            ...orders[k],
                            ...newO,
                        };
                    }
                }
            }));
        }

        if (isChanged) {
            this.setOrdersInFile(orders);
        }
    }

    getOrdersFromFile() {
        let orders;

        if (fs.existsSync(this.logOrdersFile)) {
            orders = fs.readFileSync(this.logOrdersFile).toString();
        }

        if (orders) {
            orders = JSON.parse(orders);
        } else {
            orders = [];
        }

        return orders;
    }

    setOrdersInFile(orders: any) {
        // orderTrades
        // orderId
        fs.writeFileSync(this.logOrdersFile, JSON.stringify(orders));
    }

    async logOrders(order: never, type: undefined) {
        try {
            if (this.backtest || !order) {
                return;
            }

            const orders = this.getOrdersFromFile();

            if (order.orderId) {
                this.orders[order.orderId] = order;
            }

            const time = new Date();

            time.setMilliseconds(0);

            // time.setSeconds(0);

            // Логируем время события, чтобы нанести на график.
            order.logOrderTime = time.getTime();

            if (type) {
                order.type = type;
                order.settings = {
                    takeProfit: this.takeProfit,
                    stopLoss: this.stopLoss,
                    volume: this.volume,
                    lotsSize: this.lotsSize,
                    support: this.support,
                    resistance: this.resistance,
                };

                if (this.totalNowSharesAmount) {
                    order.totalNowSharesAmount = this.totalNowSharesAmount;
                }
                if (this.currentTP) {
                    order.currentTP = this.currentTP;
                }
                if (this.currentSL) {
                    order.currentSL = this.currentSL;
                }
            }

            const position = this.getPositionsByInstrumentId(order.instrumentId);

            if (position) {
                order.position = position;
            }

            // Тут могут быть ещё и positions.
            // TODO: переименовать.
            orders.push(order);

            this.setOrdersInFile(orders);
        } catch (e) {
            console.log('logOrders', e); // eslint-disable-line no-console
        }
    }

    async closePosition(price: any) {
        if (this.backtest) {
            return this.backtestClosePosition(price);
        }
    }
    backtestClosePosition(_price: any) {
        throw new Error('Method not implemented.');
    }

    async getOperations() {
        return this.accountId && this.instrumentId && this.cb.getOperations &&
            await this.cb.getOperations(this.accountId,
                this.isPortfolio ? undefined : this.instrumentId, 1, this.date);
    }

    async getPortfolio() {
        return await this.TRequests.getPortfolio(this.accountId);
    }

    async getCurrentPositions() {
        if (this.backtest) {
            return this.getBacktestPositions();
        }

        return this.currentPositions;
    }

    async getPositions() {
        try {
            if (this.backtest) {
                return this.getBacktestPositions();
            }

            if (!this.accountId) {
                throw 'Укажите accountId';
            }

            return await this.TRequests.getPositions(this.accountId);
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    getBacktestPositions() {
        throw new Error('Method not implemented.');
    }

    checkInstrumentId(instrumentId: any) {
        if (this.isPortfolio) {
            return true;
        }

        return instrumentId === this.instrumentId || Boolean(this.tickerInfo && (
            instrumentId === this.tickerInfo.noBoardInstrumentId ||
            instrumentId === this.tickerInfo.noMarketInstrumentId));
    }

    async getOrders() {
        return (this.currentOrders || []).filter((p: { instrumentId: any; }) => this.checkInstrumentId(p.instrumentId));
    }

    async hasOpenPositions(type = 'share') {
        try {
            if (this.backtest) {
                return this.hasBacktestOpenPositions();
            }

            if (!this.currentPositions?.length) {
                return false;
            }

            return Boolean(this.currentPositions.filter(p =>
                Boolean(this.checkInstrumentId(p.instrumentId)) && p.instrumentType === type).length);
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }
    hasBacktestOpenPositions() {
        throw new Error('Method not implemented.');
    }

    hasOpenOrders() {
        return Boolean(this.currentOrders && this.currentOrders
            .filter((o: { instrumentId: any; }) => this.checkInstrumentId(o.instrumentId)).length);
    }

    hasBlockedPositions(instrumentUid?: string) {
        if (!this.currentPositions?.length) {
            return false;
        }

        if (instrumentUid) {
            return Boolean(this
                .currentPositions
                .some(p => Boolean(p.blocked) && p.instrumentUid === instrumentUid));
        }

        return this
            .currentPositions
            .some(p => Boolean(p.blocked)) ||
            this.tickerInfo.some((t: { tradingStatus: number; }) => t.tradingStatus !== 5);
    }

    async syncPos() {
        try {
            await this.updatePortfolio();
            await this.updatePositions();
        } catch (e) {
            console.log('syncPos', e); // eslint-disable-line
        }
    }

    /**
     * Сверяет позиции текущие и позиции в портфолио.
     * Поскольку позиции в портфолио запаздывают с обновлением при активной торговле.
     *
     * @returns {Boolean}
     */
    async hasAllSyncedBalance(): boolean {
        try {
            if (!this.currentPositions || !this.currentPositions[0] || typeof this.currentPositions[0].quantity?.units === 'undefined') {
                await this.syncPos();

                return false;
            }

            const isSync = this.currentPositions.every(p =>
                p?.quantity?.units && p?.quantity?.units === p?.balance && !p?.blocked,
            );

            if (!isSync) {
                await this.syncPos();

                return false;
            }

            const posInstrumentIdCache = this.currentPositions.reduce((prev, cur) => {
                if (cur.instrumentType === 'share') {
                    prev[cur.instrumentId] = true;
                }

                return prev;
            }, {});

            const portfolioPos = this.currentPortfolio?.positions?.reduce((prev: { allMatch: boolean; sum: number; }, current: { instrumentType: string; instrumentId: string | number; }) => {
                if (!prev.allMatch) {
                    return prev;
                }

                if (current.instrumentType === 'share') {
                    ++prev.sum;

                    if (!posInstrumentIdCache[current.instrumentId]) {
                        prev.allMatch = false;
                    }
                }

                return prev;
            }, {
                sum: 0,
                allMatch: true,
            });

            if (!portfolioPos || !portfolioPos.allMatch) {
                await this.syncPos();

                return false;
            }

            if (Object.keys(posInstrumentIdCache).length !== portfolioPos.sum) {
                await this.syncPos();

                return false;
            }

            return true;
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    async closeAllOrders() {
        this.currentOrders
            .filter((o: { executionReportStatus: number; }) => [4, 5].includes(o.executionReportStatus))
            .forEach(async (o: { orderId: any; }) => await this.cancelOrder(o.orderId));
    }

    async sell(price: any, instrumentId: any, lotsSize: any, type: any) {
        try {
            if (!this.instrumentId && !instrumentId) {
                return;
            }

            if (this.backtest) {
                return this.backtestClosePosition(price || this.lastPrice, lotsSize || this.lotsSize);
            }

            console.log('sell', type || '', lotsSize); // eslint-disable-line no-console

            const order = this.cb.postOrder && (await this.cb.postOrder(
                this.accountId,
                instrumentId || this.instrumentId,
                lotsSize || this.lotsSize,
                price || this.lastPrice, // структура из units и nano
                this.enums.OrderDirection.ORDER_DIRECTION_SELL,
                this.orderType || this.enums.OrderType.ORDER_TYPE_LIMIT,
                this.genOrderId(),
            ));

            order && this.logOrders && this.logOrders(order, type);

            await this.updateOrders();
            this.setLastOrderTime();
        } catch (e) {
            console.log('sell', e); // eslint-disable-line no-console
        }
    }

    setLastOrderTime() {
        this.lastOrderTime = new Date().getTime();
    }

    setActiveOrder() {

    }

    getMinPriceIncrement(sum: number, minInc: number) {
        return Math.floor(sum / minInc) * minInc;
    }

    static addMinPriceIncrement(price: Quotation, minInc: Quotation) {
        let units = price.units + minInc.units;
        let nano = price.nano + minInc.nano;

        if (nano >= 1e9) {
            units += minInc.units || 1;
            nano -= 1e9;
        }

        return {
            units,
            nano,
        };
    }

    static subMinPriceIncrement(price: Quotation, minInc: Quotation) {
        let units = price.units - minInc.units;
        let nano = price.nano - minInc.nano;

        if (nano < 0) {
            units -= minInc.units || 1;
            nano += 1e9;
        }

        return {
            units,
            nano,
        };
    }

    static resolveMinPriceIncrement(price: Quotation, minInc: Quotation) {
        let units = this.getMinPriceIncrement(price.units, minInc.units);
        let nano = this.getMinPriceIncrement(price.nano, minInc.nano);

        if (nano >= 1e9) {
            units += minInc.units || 1;
            nano -= 1e9;
        }

        return {
            units,
            nano: !minInc.nano && nano ? 0 : nano,
        };
    }

    static getMinPriceIncrement(sum: number, minInc: number) {
        if (!minInc || !sum) {
            return sum;
        }

        const int = Math.floor(sum / minInc) * minInc;
        const fract = Math.floor(sum % minInc);

        return !fract ? int : int + minInc;
    }

    /**
     * Расчитывает цену фиксации по TP.
     *
     * @param {?Boolean} isForShort — расчитать для позиции шорта.
     * @param {Object[units, nano]} price — цена, от которой расчитывать цену заявки.
     * @returns
     */
    getTakeProfitPrice(isForShort: boolean, price: MoneyValue): MoneyValue | Quotation | undefined {
        try {
            if (typeof isForShort === 'undefined') {
                return;
            }

            if (!this.backtest && (!price || !this.tickerInfo)) {
                return;
            }

            const profit = isForShort ? (this.takeProfit + 1) : (1 - this.takeProfit);

            const p = this.getPrice(price) * profit;
            let units = Math.floor(p);
            let nano = p * 1e9 - Math.floor(p) * 1e9;

            if (this.tickerInfo.minPriceIncrement) {
                if (this.tickerInfo.minPriceIncrement.units) {
                    units = this.getMinPriceIncrement(units, this.tickerInfo.minPriceIncrement.units);
                }

                if (this.tickerInfo.minPriceIncrement.nano) {
                    nano = this.getMinPriceIncrement(nano, this.tickerInfo.minPriceIncrement.nano);
                }
            }

            return {
                units,
                nano,
                currency: price.currency || '',
            };
        } catch (e) {
            console.log('getTakeProfitPrice', e); // eslint-disable-line no-console
        }

        return undefined;
    }

    // /**
    //  * Расчитывает цену лимитной заявки, которая ставится меньше текущей цены.
    //  *
    //  * @param {?Boolean} isForShort — расчитать для позиции шорта.
    //  * @param {Object[units, nano]} price
    //  * @param {Object[units, nano]} minPriceIncrement
    //  * @param {?Number} deltaSize — сколько раз по minPriceIncrement нужно отступить от текущей цены.
    //  */
    // getLimitPrice(isForShort, price, minPriceIncrement, deltaSize = 1) {
    //     let units;
    //     let nano;

    //     // Для лонга уменьшаем заявку,
    //     // для шорта увеличиваем.
    //     if (isForShort) {
    //         price.units = price.units + minPriceIncrement.units * deltaSize;
    //         price.nano = price.nano + minPriceIncrement.nano * deltaSize;
    //     } else {
    //         price.units = price.units - minPriceIncrement.units * deltaSize;
    //         price.nano = price.nano - minPriceIncrement.nano * deltaSize;
    //     }

    //     return {
    //         units,
    //         nano,
    //     };
    // }

    getStopLossPrice(buy: any, price: any) {
        if (typeof buy === 'undefined') {
            return;
        }

        if (!price || !this.tickerInfo) {
            return;
        }
        const profit = buy ? (1 - this.stopLoss) : (1 + this.stopLoss);

        const p = this.getPrice(price) * profit;
        let units = Math.floor(p);
        let nano = p * 1e9 - Math.floor(p) * 1e9;

        if (this.tickerInfo.minPriceIncrement) {
            if (this.tickerInfo.minPriceIncrement.units) {
                units = this.getMinPriceIncrement(units, this.tickerInfo.minPriceIncrement.units);
            }

            if (this.tickerInfo.minPriceIncrement.nano) {
                nano = this.getMinPriceIncrement(nano, this.tickerInfo.minPriceIncrement.nano);
            }
        }

        return {
            units,
            nano,
        };
    }

    setStopLoss() {

    }

    async getOpenOrders() {
        return await this.TRequests.getOpenOrders(this.accountId);
    }

    async openOrdersExist() {
        const orders = this.getOpenOrders();

        return Boolean(orders && orders.length);
    }

    async cancelUnfulfilledOrders() {
        if (!this.cb.getOrders) {
            return;
        }

        const { orders } = await this.cb.getOrders(this.accountId, this.instrumentId);

        for (const o of orders) {
            await this.cancelOrder(o.orderId);
        }

        this.setLastOrderTime();
    }

    async cancelOrder(orderId: any) {
        this.setLastOrderTime();

        if (this.TRequests?.cancelOrder) {
            return await this.TRequests?.cancelOrder(this.accountId, orderId);
        }

        return (await this.cb.cancelOrder(this.accountId, orderId));
    }

    genOrderId() {
        return Common.genOrderId();
    }

    roundPrice(price, num = 9) {
        return Common.roundPrice(price, num);
    }

    static roundPrice(price, num = 9) {
        const p = this.getPrice(price);

        if (!p) {
            return p;
        }

        return parseFloat(parseFloat(p).toFixed(num));
    }

    static genOrderId() {
        // const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        // const charactersLength = characters.length;
        // let result = '';

        // for (let i = 0; i < length; i++) {
        //     result += characters.charAt(Math.floor(Math.random() *
        //         charactersLength));
        // }

        let result = uuidv4();

        if (!this.orderIds) {
            this.orderIds = {};
        }

        // Сохраняем сгенереный ключ, чтобы точно был уникальным
        // + ведём статистику насколько генератор ок.
        if (this.orderIds[result]) {
            ++this.orderIds[result];
            result = this.genOrderId();
        } else {
            this.orderIds[result] = 1;
        }

        return result;
    }

    static getLogs(robotName: any, accountId: any, instrumentId: any, date: any) {
        try {
            const { dir, name } = this.getLogFileName(robotName, accountId, instrumentId, date);
            const logFile = path.join(dir, name);

            let logs;

            if (fs.existsSync(logFile)) {
                logs = fs.readFileSync(logFile).toString();

                if (logs) {
                    return JSON.parse(logs);
                }
            }
        } catch (e) { console.log(e) } // eslint-disable-line no-console
    }

    static getLogFileName(name: (name: any, accountId: any, arg2: any, arg3: Date) => { dir: any; name: any; }, accountId: any, instrumentId: any, date: Date) {
        const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };

        if (!name || !accountId || !instrumentId || !date) {
            return {};
        }

        const instruments = Array.isArray(instrumentId) ? instrumentId.join(',') : instrumentId;
        const accIds = Array.isArray(accountId) ? accountId.join(',') : accountId;

        return {
            dir: path.resolve(__dirname, '../../orders', name, accIds, instruments),
            name: new Date(Number(date)).toLocaleString('ru', dateOptions) + '.json',
        };
    }

    static getLogFiles(name: any, accountId: any, instrumentId: any, date: any) {
        if (!name || !accountId || !instrumentId || !date) {
            return [];
        }

        const { dir } = this.getLogFileName(name, accountId, instrumentId, date);

        return fs.readdirSync(path.resolve(dir)).reduce((prev: number[], file: string) => {
            // const p = path.resolve(dir, file);

            if (file !== this.settingsFileName) {
                const n = file.replace('.json', '').split('.');

                // Переставляем значения местами, чтобы привести ru формат к en.
                prev.push(new Date(n[2], n[1] - 1, n[0]).getTime());
            }

            return prev;
        }, []);
    }

    static getStaticFileSettings(name: any, accountId: any, instrumentId: any) {
        if (!name || !accountId) {
            return;
        }

        const dir = path.resolve(__dirname, '../../orders', name.toString(), accountId.toString(), instrumentId ? instrumentId.toString() : '');

        mkDirByPathSync(dir);

        return path.join(dir, this.settingsFileName);
    }

    /**
     * Получение настроек робота из файла или значений по умолчанию.
     *
     * @param {String} name
     * @param {String} instrumentId
     * @param {String} accountId
     * @returns
     */
    static getSettings(name: (name: any, accountId: any, arg2: any, arg3: Date) => { dir: any; name: any; }, accountId: undefined, instrumentId: undefined) {
        const settings = {
            isAdviser: false,
            takeProfit: 0.05,
            stopLoss: 0.02,
            volume: 1,
            lotsSize: 1,

            profitRange: 0.2,
            iagreetrade: false,

            orderType: 1, // лимитная заявка =1. Рыночная =2. this.enums.OrderType.ORDER_TYPE_LIMIT
            orderTimeout: 30, // секунд.

            startTradingTimeHours: 0,
            startTradingTimeMinutes: 0,
            endTradingTimeHours: 23,
            endTradingTimeMinutes: 59,

            tradingDays: 0b1111100, // Битовая маска 7 значений для 7 дней. Старший бит — понедельник.

            support: { units: 0, nano: 0 },
            resistance: { units: 0, nano: 0 },

            breakeven: 0.0011,
            breakevenStep1: 0.002,
            breakevenStep2: 0.005,
            breakevenStep3: 0.0075,
            breakevenStep4: 0.0095,
        };

        if (name && accountId) {
            const file = this.getStaticFileSettings(name, accountId, instrumentId);

            if (fs.existsSync(file)) {
                return JSON.parse(fs.readFileSync(file).toString());
            }
        }

        return settings;
    }

    /**
     * Устанавливает настройки и сохраняет в файл.
     *
     * @param {String} name
     * @param {Object} settings
     * @param {String} accountId
     * @param {String} instrumentId
     * @returns
     */
    static setSettings(name: (name: any, accountId: any, arg2: any, arg3: Date) => { dir: any; name: any; }, settings: { [x: string]: string; isAdviser: any; takeProfit: string | number; stopLoss: string | number; volume: number; orderTimeout: string | number; lotsSize: number; su: number; sn: number; ru: number; rn: number; orderType: number; startTradingTimeHours: number; endTradingTimeHours: number; startTradingTimeMinutes: number; endTradingTimeMinutes: number; tradingDays: number; }, accountId: any, instrumentId: any) { // eslint-disable-line
        const current = this.getSettings(name);

        typeof settings.isAdviser !== 'undefined' && (current.isAdviser = Boolean(settings.isAdviser));

        settings.takeProfit = parseFloat(settings.takeProfit);
        settings.takeProfit > 0 && settings.takeProfit <= 100 && (current.takeProfit = settings.takeProfit);

        settings.stopLoss = parseFloat(settings.stopLoss);
        settings.stopLoss > 0 && settings.stopLoss <= 100 && (current.stopLoss = settings.stopLoss);

        settings.profitRange = parseFloat(settings.profitRange);
        settings.profitRange > 0 && settings.profitRange <= 100 && (current.profitRange = settings.profitRange);

        current.iagreetrade = Boolean(settings.iagreetrade);

        settings.volume = parseInt(settings.volume * 100, 10) / 100;
        settings.volume > 0 && settings.volume <= 100 && (current.volume = settings.volume);

        settings.orderTimeout = parseFloat(settings.orderTimeout);

        [
            'lotsSize',

            'su',
            'sn',
            'ru',
            'rn',

            'orderType',

            'startTradingTimeHours',
            'startTradingTimeMinutes',
            'endTradingTimeHours',
            'endTradingTimeMinutes',

            'tradingDays',
        ].forEach(name => {
            settings[name] = parseInt(settings[name], 10);
        });

        settings.lotsSize > 0 && (current.lotsSize = settings.lotsSize);

        settings.su > 0 && (current.support.units = settings.su);
        settings.sn > 0 && (current.support.nano = settings.sn);

        settings.ru > 0 && (current.resistance.units = settings.ru);
        settings.rn > 0 && (current.resistance.nano = settings.rn);

        [1, 2].includes(settings.orderType) && (current.orderType = settings.orderType);

        settings.orderTimeout > 0 && (current.orderTimeout = settings.orderTimeout);

        if (settings.startTradingTimeHours >= 0 && settings.startTradingTimeHours <= 23 &&
            settings.startTradingTimeHours <= settings.endTradingTimeHours) {
            current.startTradingTimeHours = settings.startTradingTimeHours;
        } else {
            current.startTradingTimeHours = 0;
        }

        if (settings.endTradingTimeHours >= 0 && settings.endTradingTimeHours <= 23 &&
            settings.endTradingTimeHours >= settings.startTradingTimeHours) {
            current.endTradingTimeHours = settings.endTradingTimeHours;
        } else {
            current.endTradingTimeHours = 23;
        }

        if (settings.startTradingTimeMinutes >= 0 && settings.startTradingTimeMinutes <= 59 &&
            settings.startTradingTimeMinutes <= settings.endTradingTimeMinutes) {
            current.startTradingTimeMinutes = settings.startTradingTimeMinutes;
        } else {
            current.startTradingTimeMinutes = 0;
        }

        if (settings.endTradingTimeMinutes >= 0 && settings.endTradingTimeMinutes <= 59 &&
            settings.endTradingTimeMinutes >= settings.startTradingTimeMinutes) {
            current.endTradingTimeMinutes = settings.endTradingTimeMinutes;
        } else {
            current.endTradingTimeMinutes = 59;
        }

        if (settings.tradingDays > 0 && settings.tradingDays <= 127) {
            current.tradingDays = settings.tradingDays;
        }

        settings.breakeven = parseFloat(settings.breakeven);
        settings.breakevenStep1 = parseFloat(settings.breakevenStep1);
        settings.breakevenStep2 = parseFloat(settings.breakevenStep2);
        settings.breakevenStep3 = parseFloat(settings.breakevenStep3);
        settings.breakevenStep4 = parseFloat(settings.breakevenStep4);
        settings.breakeven > 0 && (current.breakeven = settings.breakeven);
        settings.breakevenStep1 > 0 && (current.breakevenStep1 = settings.breakevenStep1);
        settings.breakevenStep2 > 0 && (current.breakevenStep2 = settings.breakevenStep2);
        settings.breakevenStep3 > 0 && (current.breakevenStep3 = settings.breakevenStep3);
        settings.breakevenStep4 > 0 && (current.breakevenStep4 = settings.breakevenStep4);

        if (name && accountId) {
            const file = this.getStaticFileSettings(name, accountId, instrumentId);

            file && fs.writeFileSync(file, JSON.stringify(current));
        }

        return current;
    }

    /**
     * Устанавливает настройки для запущенного робота.
     *
     * @param {String} name
     * @param {Object} settings
     * @param {String} accountId
     * @param {String} instrumentId
     * @returns
     */
    setCurrentSettings(settings: any) {
        // const current =
        Common.setSettings(this.name, settings, this.accountId,

            // , this.getFileName()
        );

        this.getCurrentSettings();
    }

    getCurrentSettings() {
        const current = Common.getSettings(this.name, this.accountId,

            // , this.getFileName()
        );

        this.isAdviser = current.isAdviser;
        this.takeProfit = current.takeProfit;
        this.stopLoss = current.stopLoss;
        this.volume = current.volume;
        this.lotsSize = current.lotsSize;

        this.profitRange = current.profitRange;

        this.iagreetrade = current.iagreetrade;

        // Уровни поддержки и сопротивления.
        this.support = current.support;
        this.resistance = current.resistance;

        this.orderType = current.orderType;
        this.orderTimeout = current.orderTimeout;

        this.startTradingTimeHours = current.startTradingTimeHours;
        this.startTradingTimeMinutes = current.startTradingTimeMinutes;
        this.endTradingTimeHours = current.endTradingTimeHours;
        this.endTradingTimeMinutes = current.endTradingTimeMinutes;

        if (current.breakeven) {
            this.breakeven = current.breakeven;
        }

        if (current.breakevenStep1) {
            this.breakevenStep1 = current.breakevenStep1;
        }

        if (current.breakevenStep2) {
            this.breakevenStep2 = current.breakevenStep2;
        }

        if (current.breakevenStep3) {
            this.breakevenStep3 = current.breakevenStep3;
        }

        if (current.breakevenStep4) {
            this.breakevenStep4 = current.breakevenStep4;
        }

        this.tradingDays = current.tradingDays;
    }

    getTickerInfo() {
        return this.tickerInfo || {};
    }

    /**
     * Сохраняет основные параметры расчётов по портфелю,
     * чтобы не пересчитывать их при выставлении ордеров.
     *
     * @param {*} params
     * @returns
     */
    saveCalculatedPortfolioParams(params: { totalNowSharesAmount: any; expectedYield: any; currentTP: any; currentSL: any; }) {
        const {
            totalNowSharesAmount,
            expectedYield,
            currentTP,
            currentSL,
        } = params;

        this.totalNowSharesAmount = totalNowSharesAmount;
        this.expectedYield = expectedYield;
        this.currentTP = currentTP;
        this.currentSL = currentSL;
        this.positionsProfit = params;

        return params;
    }

    resetCalculatedPortfolioParams() {
        delete this.totalNowSharesAmount;
        delete this.expectedYield;
        delete this.currentTP;
        delete this.currentSL;
        delete this.positionsProfit;
    }

    /**
     * Рассчитывает параметры торговли для портфеля.
     *
     * @param {?String} type — тип инструментов, для которых нужно посчитать.
     * @returns
     */
    calcPortfolio(type: string | null = 'share') {
        try {
            const calcParams = Common.calcPortfolio.call(this, this.currentPositions, {
                volume: this.volume,
                takeProfit: this.takeProfit,
                stopLoss: this.stopLoss,
            }, type);

            this.saveCalculatedPortfolioParams(calcParams);

            return calcParams;
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    toMoneyString(d: number) {
        if (isNaN(Number(d))) {
            return d;
        }

        const sp = Math.abs(Number(d)) > 1 ?
            Number(this.roundPrice(d)).toFixed(2).split('.') :
            String(this.roundPrice(d)).split('.');

        const first = sp[0].split('').reverse();

        const nextText = first.reduce((acc, num, key) => {
            return (key && !(key % 3)) ? `${acc} ${num}` : `${acc}${num}`;
        }, '').split('').reverse().join('');

        const money = nextText + (sp[1] && ('.' + sp[1]) || '');

        if (money[0] === '-' && money[1] === ' ') {
            const next = money.split('');

            next[1] = '';

            return next.join('');
        }

        return money;
    }

    static calcPortfolio(positions: any[],
        settings: { volume: number; takeProfit: number; stopLoss: number; }, type = 'share') { // eslint-disable-line
        try {
            if (!positions?.length) {
                return {};
            }

            const { totalStartSharesAmount,
                expectedYield,
                totalNowSharesAmount,
            } = positions.reduce(
                (
                    prev: {
                        totalNowSharesAmount: number; totalStartSharesAmount: number; expectedYield: any;
                    },
                    current: {
                        instrumentType: string; averagePositionPrice: any; quantity: any; expectedYield: any; instrumentId: string | number;
                    },
                ) => {
                    if (current?.instrumentType !== type) {
                        return prev;
                    }

                    const avgPrice = this.getPrice(current.averagePositionPrice) *
                        Math.abs(this.getPrice(current.quantity));

                    const expectedYield = this.getPrice(current.expectedYield);

                    if (current.currentPrice) {
                        prev.totalNowSharesAmount += this.getPrice(current.currentPrice) *
                            Math.abs(this.getPrice(current.quantity));
                    } else {
                        prev.totalNowSharesAmount += avgPrice + expectedYield;
                    }

                    prev.totalStartSharesAmount += avgPrice;
                    prev.expectedYield += expectedYield;

                    return prev;
                }, {
                    totalStartSharesAmount: 0,
                    totalNowSharesAmount: 0,
                    expectedYield: 0,
                }) || {};

            // setSharesPrice((expectedYield < 0 ? '-' : '') + getYield(totalStartSharesAmount, expectedYield));
            const positionsProfit = positions?.reduce(
                (prev: { [x: string]: { positionVolume: any; }; currentTP: any; currentSL: number; },
                    p: { instrumentType: string; quantityLots: { units: number; nano: any; }; instrumentId: string | number; },
                ) => {
                    if (p?.instrumentType !== type) {
                        return prev;
                    }

                    const positionVolume = !p.quantityLots.units && p.quantityLots.nano ? 0 :
                        p.quantityLots.units * settings.volume;

                    prev[p.instrumentId] = {
                        // Для неполной позиции не применяем.
                        // Берём часть позиции в соответствии с настройками, но не менее одной позиции.
                        positionVolume: positionVolume > 0 ? Math.max(positionVolume, 1) :
                            positionVolume < 0 ? Math.min(positionVolume, -1) : 0,
                    };

                    if (prev[p.instrumentId].positionVolume) {
                        // const lotSize = Math.abs(parseInt(p.quantity.units / p.quantityLots.units));
                        prev.currentTP = totalStartSharesAmount + totalStartSharesAmount * settings.takeProfit;
                        prev.currentSL = totalStartSharesAmount - totalStartSharesAmount * settings.stopLoss;
                    }

                    return prev;
                }, {
                    currentTP: 0,
                    currentSL: 0,
                }) || {};

            return {
                ...positionsProfit,
                totalStartSharesAmount,
                totalNowSharesAmount,
                expectedYield,
            };
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    async getAllShares() {
        try {
            this.allSharesInfo = await this.TRequests?.getAllShares();

            return this.allSharesInfo;
        } catch (e) {
            console.log(e); // eslint-disable-line no-console

            return [];
        }
    }

    /**
     * Возвращает массив акций, доступных для торговли и подходящих для заданного лимита лота.
     */
    async getSharesForTrading(props?: { maxLotPrice?: number }) {
        return await this.TRequests?.getSharesForTrading(props);
    }

    static median(values) {
        if (values.length === 0) return 0;

        values.sort((a, b) => {
            return a - b;
        });

        const half = Math.floor(values.length / 2);

        if (values.length % 2) { return values[half] }

        return (values[half - 1] + values[half]) / 2.0;
    }

    static async order(sdk?: ReturnType<typeof createSdk>,
        props: {
            accountId: string;
            instrumentId: string;
            quantity: number;
            price?: string;
            orderType?: OrderType;
            timeInForceType?: TimeInForceType;
        },
    ) {
        if (!sdk) {
            throw 'В order не передан sdk';
        }

        const {
            accountId,
            price,
            instrumentId,
            quantity,
            orderType,
            timeInForceType,
        } = props;

        try {
            if (!sdk?.orders?.postOrder || !accountId || !quantity) {
                return;
            }

            const orderId = this.genOrderId();
            const direction = quantity < 0 ?
                sdk?.OrderDirection.ORDER_DIRECTION_SELL :
                sdk?.OrderDirection.ORDER_DIRECTION_BUY;

            const data = {
                quantity: Math.abs(quantity),
                accountId,
                direction,
                orderId,
                instrumentId,
                orderType: orderType || sdk.OrderType.ORDER_TYPE_BESTPRICE,
            };

            if (price) {
                data.price = price;
            }

            if (timeInForceType) {
                data.timeInForce = timeInForceType;
            }

            return await sdk?.orders?.postOrder(data);
        } catch (e) {
            console.log('order', e); // eslint-disable-line no-console
        }
    }
}
