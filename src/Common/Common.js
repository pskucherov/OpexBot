const { mkDirByPathSync } = require('../utils');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

try {
    class Common {
        static settingsFileName = 'settings.json';

        constructor(accountId, _adviser, backtest, callbacks = {
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
        }) {
            this.accountId = accountId;
            this.backtest = Boolean(backtest);
            this.enums = options.enums;
            this.brokerId = options.brokerId;
            this.tgBot = options.tgBot;

            // Методы, с помощью которых робот может общаться с внешним миром.
            this.cb = callbacks;

            // Автоматически переставлять stopLoss и takeProfit при движении цены в нужную сторону.
            // this.useTrailingStop = options.useTrailingStop;
            this.isSandbox = Boolean(options.isSandbox);
            this.blueChipsShares = options.blueChipsShares;

            (async () => {
                this.init();
                this.initAsync();
                this.processing();
            })();
        }

        init() {
            // Таймер подписки на события.
            this.subscribesTimer = 100;

            // Таймер выполнения process
            this.robotTimer = 3000;
            this.subscribeDataUpdated = {};

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
            await this.updateOrdersInLog();
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
            const p = await this.getPositions();

            if (!p || !p.securities) {
                return [];
            }

            this.currentPositions = ([].concat(p.securities, p.futures, p.options))
                .reduce((prev, cur) => {
                    const i = this.currentPortfolio?.positions?.findIndex(f => f.instrumentId === cur.instrumentId);

                    if (i === -1) {
                        return prev;
                    }

                    prev.push({
                        ...this.currentPortfolio?.positions[i],
                        ...cur,
                    });

                    return prev;
                }, []);
        }

        /**
         *
         * @param {?String} param
         * @returns
         */
        getParams(param) {
            if (param) {
                return this[param];
            }

            return {
                timer: this.timer,
            };
        }

        timer(time) {
            return new Promise(resolve => setTimeout(resolve, time));
        }

        async restart(timeout = 100) {
            this.stop();
            await this.timer(timeout);
            this.start();
        }

        getSubscribeOptions() {
            const abortSubscribe = (_type, abort) => {
                if (!this.inProgress) {
                    abort();
                }
            };

            return {
                signal: {
                    addEventListener: abortSubscribe,
                    removeEventListener: abortSubscribe,
                },
            };
        }
        subscribes() { // eslint-disable-line sonarjs/cognitive-complexity
            try {
                if (this.backtest) {
                    return;
                }
                const { subscribes } = this.cb;

                console.log('subscribes', subscribes);

                ['lastPrice', 'orderbook'].forEach(name => {
                    if (subscribes[name] && !this.isSandbox) {
                        setImmediate(async () => {
                            const subscribeArr = subscribes[name]();

                            let gen = subscribeArr[0]((async function* () {
                                try {
                                    while (this.inProgress) {
                                        await this.timer(this.subscribesTimer);

                                        if (this.instrumentId) {
                                            const instrumentId = typeof this.instrumentId === 'string' ? this.instrumentId.split(',') : this.instrumentId;

                                            yield subscribeArr[1](instrumentId);
                                        }
                                    }

                                    gen = null;
                                } catch (e) {
                                    console.log(e); // eslint-disable-line no-console
                                }
                            }).call(this), this.getSubscribeOptions());

                            try {
                                for await (const data of gen) {
                                    if (data[name]) {
                                        this.subscribeDataUpdated[name] = true;
                                        const isLastPrice = name === 'lastPrice';
                                        const currentData = isLastPrice ? data[name].price : data[name];

                                        this[data[name].instrumentId] || (this[data[name].instrumentId] = {});
                                        this[data[name].instrumentId][name] = currentData;

                                        if (!this.isPortfolio) {
                                            this[name] = currentData;
                                        }
                                    }
                                    if (!this.inProgress) {
                                        gen = null;
                                        break;
                                    }
                                }
                            } catch (e) {
                                console.log(e); // eslint-disable-line no-console

                                // Перезапускаем робота в случае ошибки.
                                // Ошибка сюда прилетит в случае обрыва соединения.
                                await this.restart(this.robotTimer + this.subscribesTimer);
                            }
                        });
                    }
                });

                ['orders', 'positions'].forEach(name => {
                    if (subscribes[name] && !this.isSandbox) {
                        setImmediate(async () => {
                            try {
                                let gen = subscribes[name]({
                                    accounts: [this.accountId],
                                }, this.getSubscribeOptions());

                                for await (const data of gen) {
                                    if (data.orderTrades) {
                                        if (!this.orderTrades) {
                                            this.orderTrades = [];
                                        }

                                        this.orderTrades.push(data.orderTrades);
                                        this.logOrders(data);
                                        await this.updateOrders();
                                    } else if (data.position && this.isPortfolio) {
                                        [
                                            'securities',

                                            // 'futures',
                                            // 'options',
                                        ].forEach(name => {
                                            try {
                                                if (!data.position[name] || !data.position[name].length) {
                                                    return;
                                                }

                                                data.position[name].forEach(async p => {
                                                    const currentIndex = this.currentPositions.findIndex(c => {
                                                        return c.instrumentId === p.instrumentId &&
                                                            c.instrumentType === p.instrumentType;
                                                    });

                                                    if (currentIndex >= 0) {
                                                        this.currentPositions[currentIndex] = {
                                                            ...this.currentPositions[currentIndex],
                                                            ...p,
                                                        };
                                                    } else {
                                                        await this.updatePositions();
                                                    }
                                                });
                                            } catch (e) {
                                                console.log(e); // eslint-disable-line no-console
                                            }
                                        });

                                        await this.updateInstrumentId();
                                        await this.updateOrdersInLog();
                                    }

                                    if (!this.inProgress) {
                                        gen = null;
                                        break;
                                    }
                                }
                            } catch (e) {
                                console.log(e); // eslint-disable-line no-console

                                // Перезапускаем робота в случае ошибки.
                                // Ошибка сюда прилетит в случае обрыва соединения.
                                await this.restart(this.robotTimer + this.subscribesTimer);
                            }
                        });
                    }
                });
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }
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

                this.getCurrentSettings();

                if (!this.backtest) {
                    await this.checkExchangeDay();
                    await this.checkTradingDayAndTime();

                    if (this.brokerId === 'FINAM') {
                        await this.updateOrders();
                        await this.updatePortfolio();

                        // update orderbook
                        // update price
                        // TODO: поменять на bid и ...
                        this.testData = this.cb.getQuotationsAndOrderbook(this.instrumentId);
                        this.lastPrice = this.testData?.quotations?.bid;
                    }
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
                    if (!this.backtest && this.instrumentId && this.cb.cacheState &&
                        (this.subscribeDataUpdated.orderbook && this.subscribeDataUpdated.lastPrice)) {
                        this.cb.cacheState(this.getFileName(), new Date().getTime(), this.lastPrice, this.orderbook);
                        this.subscribeDataUpdated.lastPrice = false;
                        this.subscribeDataUpdated.orderbook = false;
                    }
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

        /**
         * Модуль принятия решений о покупке.
         * @returns {Boolean}
         */
        decisionBuy() {
            return false;
        }

        /**
         * Модуль принятия решений о продаже.
         * @returns {Boolean}
         */
        decisionSell() {
            return false;
        }

        /**
         * Модуль принятия решений о закрытии существующей позиции.
         * @returns {Boolean}
         */
        decisionClosePosition() {
            return false;
        }

        setControlsCallbacks() {
            // Метод покупки
            // Продажи
            // Выставления заявки
        }

        async setCurrentState(lastPrice, candles, balance, orderbook, options) {
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
            try {
                const fileName = this.getFileName();
                if (!fileName) {
                    return;
                }

                const { dir, name } = Common.getLogFileName(this.name, this.accountId,
                    fileName, new Date());

                mkDirByPathSync(dir);
                this.logOrdersFile = path.join(dir, name);
            } catch (e) {
                console.log(e);
            }
        }

        getFileName() {
            return this.isPortfolio ? this.type : this.instrumentId;
        }

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

        static getPrice(quotation) {
            if (!quotation || typeof quotation !== 'object') {
                return quotation;
            }

            if (quotation.nano) {
                return Number(quotation.units) + Number(quotation.nano / 1e9);
            }

            return quotation.units;
        }

        getPrice(quotation) {
            return Common.getPrice(quotation);
        }

        start() {
            if (this.inProgress) {
                return;
            }

            this.inProgress = true;
            this.subscribes();

            console.log('start 321'); // eslint-disable-line no-console
        }

        stop() {
            this.inProgress = false;
            clearInterval(this.intervalId);
            console.log('stop'); // eslint-disable-line no-console
        }

        async buy(price, instrumentId, lotsSize, type) {
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

        getPositionsByInstrumentId(instrumentId) {
            if (!instrumentId) {
                return;
            }

            return this.currentPositions?.find(p => p.instrumentId === instrumentId);
        }

        async updateOrdersInLog() {
            const orders = this.getOrdersFromFile();
            let isChanged = false;

            if (this.cb.getOrderState) {
                await Promise.all(orders.map(async (o, k) => {
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

        setOrdersInFile(orders) {
            // orderTrades
            // orderId
            fs.writeFileSync(this.logOrdersFile, JSON.stringify(orders));
        }

        async logOrders(order, type) {
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

        async closePosition(price) {
            if (this.backtest) {
                return this.backtestClosePosition(price);
            }
        }

        async getOperations() {
            return this.accountId && this.instrumentId && this.cb.getOperations &&
                await this.cb.getOperations(this.accountId,
                    this.isPortfolio ? undefined : this.instrumentId, 1, this.date);
        }

        async getPortfolio() {
            return this.accountId && this.cb.getPortfolio &&
                (await this.cb.getPortfolio(this.accountId)); // , this.isPortfolio ? undefined : this.instrumentId));
        }

        async getCurrentPositions() {
            if (this.backtest) {
                return this.getBacktestPositions();
            }

            return this.currentPositions;
        }

        async getPositions() {
            if (this.backtest) {
                return this.getBacktestPositions();
            }

            if (!this.accountId) {
                throw 'Укажите accountId';
            }

            if (this.sdk) {
                return await this.sdk.getPositions({
                    accountId: this.accountId,
                });
            }

            return this.cb.getPositions &&
                (await this.cb.getPositions(this.accountId));

            // return (this.currentPositions || [])
            //     .filter(p => {
            //         return this.isPortfolio || this.checkInstrumentId(p.instrumentId); // FINAM instrumentId
            //     });
        }

        checkInstrumentId(instrumentId) {
            if (this.isPortfolio) {
                return true;
            }

            return instrumentId === this.instrumentId || Boolean(this.tickerInfo && (
                instrumentId === this.tickerInfo.noBoardInstrumentId ||
                instrumentId === this.tickerInfo.noMarketInstrumentId));
        }

        async getOrders() {
            return (this.currentOrders || []).filter(p => this.checkInstrumentId(p.instrumentId));
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

        hasOpenOrders() {
            return Boolean(this.currentOrders && this.currentOrders
                .filter(o => this.checkInstrumentId(o.instrumentId)).length);
        }

        hasBlockedPositions() {
            return this
                .currentPositions
                .some(p => Boolean(p.blocked)) ||
                this.tickerInfo.some(t => t.tradingStatus !== 5);
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
        async hasAllSyncedBalance() {
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

                const portfolioPos = this.currentPortfolio?.positions?.reduce((prev, current) => {
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
                .filter(o => [4, 5].includes(o.executionReportStatus))
                .forEach(async o => await this.cancelOrder(o.orderId));
        }

        async sell(price, instrumentId, lotsSize, type) {
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

        getMinPriceIncrement(sum, minInc) {
            return Math.floor(sum / minInc) * minInc;
        }

        /**
         * Расчитывает цену фиксации по TP.
         *
         * @param {?Boolean} isForShort — расчитать для позиции шорта.
         * @param {Object[units, nano]} price — цена, от которой расчитывать цену заявки.
         * @returns
         */
        getTakeProfitPrice(isForShort, price) {
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
                };
            } catch (e) {
                console.log('getTakeProfitPrice', e); // eslint-disable-line no-console
            }
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

        getStopLossPrice(buy, price) {
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
            try {
                // TODO: брать из OrderExecutionReportStatus
                // EXECUTION_REPORT_STATUS_NEW (4)
                // EXECUTION_REPORT_STATUS_PARTIALLYFILL (5)
                const { orders } = this.cb.getOrders && (await this.cb.getOrders(this.accountId)) || {};

                this.allOrders = orders;

                return orders && orders.filter(o => [4, 5].includes(o.executionReportStatus));
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }
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

        async cancelOrder(orderId) {
            this.setLastOrderTime();

            return (await this.cb.cancelOrder(this.accountId, orderId));
        }

        /**
         * @copypaste https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
         * @param {Number} length
         * @returns
         */
        genOrderId(length = 15) {
            return Common.genOrderId(length);
        }

        static genOrderId(length = 15) {
            // const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            // const charactersLength = characters.length;
            // let result = '';

            // for (let i = 0; i < length; i++) {
            //     result += characters.charAt(Math.floor(Math.random() *
            //         charactersLength));
            // }

            const result = uuidv4();

            if (!this.orderIds) {
                this.orderIds = {};
            }

            // Сохраняем сгенереный ключ, чтобы точно был уникальным
            // + ведём статистику насколько генератор ок.
            if (this.orderIds[result]) {
                ++this.orderIds[result];
                result = this.genOrderId(length);
            } else {
                this.orderIds[result] = 1;
            }

            return result;
        }

        static getLogs(robotName, accountId, instrumentId, date) {
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

        static getLogFileName(name, accountId, instrumentId, date) {
            const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };

            return {
                dir: path.resolve(__dirname, '../../orders', name, accountId, instrumentId),
                name: new Date(Number(date)).toLocaleString('ru', dateOptions) + '.json',
            };
        }

        static getLogFiles(name, accountId, instrumentId, date) {
            const { dir } = this.getLogFileName(name, accountId, instrumentId, date);

            return fs.readdirSync(path.resolve(dir)).reduce((prev, file) => {
                // const p = path.resolve(dir, file);

                if (file !== this.settingsFileName) {
                    const n = file.replace('.json', '').split('.');

                    // Переставляем значения местами, чтобы привести ru формат к en.
                    prev.push(new Date(n[2], n[1] - 1, n[0]).getTime());
                }

                return prev;
            }, []);
        }

        static getStaticFileSettings(name, accountId, instrumentId) {
            if (!name || !accountId || !instrumentId) {
                return;
            }

            const dir = path.resolve(__dirname, '../../orders', name, accountId, instrumentId);

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
        static getSettings(name, accountId, instrumentId) {
            const settings = {
                isAdviser: false,
                takeProfit: 0.05,
                stopLoss: 0.02,
                volume: 1,
                lotsSize: 1,

                orderType: 1, // лимитная заявка =1. Рыночная =2. this.enums.OrderType.ORDER_TYPE_LIMIT
                orderTimeout: 30, // секунд.

                startTradingTimeHours: 0,
                startTradingTimeMinutes: 0,
                endTradingTimeHours: 23,
                endTradingTimeMinutes: 59,

                tradingDays: 0b1111100, // Битовая маска 7 значений для 7 дней. Старший бит — понедельник.

                support: { units: 0, nano: 0 },
                resistance: { units: 0, nano: 0 },
            };

            if (name && accountId && instrumentId) {
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
        static setSettings(name, settings, accountId, instrumentId) { // eslint-disable-line
            const current = this.getSettings(name);

            typeof settings.isAdviser !== 'undefined' && (current.isAdviser = Boolean(settings.isAdviser));

            settings.takeProfit = parseFloat(settings.takeProfit);
            settings.takeProfit > 0 && settings.takeProfit <= 100 && (current.takeProfit = settings.takeProfit);

            settings.stopLoss = parseFloat(settings.stopLoss);
            settings.stopLoss > 0 && settings.stopLoss <= 100 && (current.stopLoss = settings.stopLoss);

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

            if (name && accountId && instrumentId) {
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
        setCurrentSettings(settings) {
            // const current =
            Common.setSettings(this.name, settings, this.accountId, this.getFileName());

            this.getCurrentSettings();
        }

        getCurrentSettings() {
            const current = Common.getSettings(this.name, this.accountId, this.getFileName());

            this.isAdviser = current.isAdviser;
            this.takeProfit = current.takeProfit;
            this.stopLoss = current.stopLoss;
            this.volume = current.volume;
            this.lotsSize = current.lotsSize;

            // Уровни поддержки и сопротивления.
            this.support = current.support;
            this.resistance = current.resistance;

            this.orderType = current.orderType;
            this.orderTimeout = current.orderTimeout;

            this.startTradingTimeHours = current.startTradingTimeHours;
            this.startTradingTimeMinutes = current.startTradingTimeMinutes;
            this.endTradingTimeHours = current.endTradingTimeHours;
            this.endTradingTimeMinutes = current.endTradingTimeMinutes;

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
        saveCalculatedPortfolioParams(params) {
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
        calcPortfolio(type = 'share') {
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

        static calcPortfolio(positions, settings, type = 'share') { // eslint-disable-line
            try {
                if (!positions?.length) {
                    return {};
                }

                const { totalStartSharesAmount,
                    expectedYield,
                    totalNowSharesAmount,
                } = positions.reduce((prev, current) => {
                    if (current?.instrumentType !== type) {
                        return prev;
                    }

                    const avgPrice = this.getPrice(current.averagePositionPrice) *
                        Math.abs(this.getPrice(current.quantity));

                    const expectedYield = this.getPrice(current.expectedYield);

                    if (this[current.instrumentId]?.lastPrice) {
                        prev.totalNowSharesAmount += this.getPrice(this[current.instrumentId]?.lastPrice) *
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
                const positionsProfit = positions?.reduce((prev, p) => {
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
    }

    module.exports.Common = Common;
} catch (e) {
    // Здесь будут только ошибки в коде робота,
    // Которые должны быть отловлены во время разработки.
    // Поэтому нет сохранения в файл. Только вывод в консоль.
    // TODO: сохранять в файл.
    console.log(e); // eslint-disable-line no-console
}
