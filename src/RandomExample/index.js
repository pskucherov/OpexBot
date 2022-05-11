try {
    const { Common } = require('../Common');

    /**
 * Торговый робот без логики со случайным срабатыванием.
 * Работает только на покупку, дальше ждёт исполнения заявки.
 * После исполнения заявки ждёт выхода по TP или SP.
 */
    class RandomExample extends Common {
        constructor(...args) {
            super(...args);
            this.name = 'RandomExample';
        }

        subscribes() {
            const { subscribes } = this.cb;

            const timer = time => new Promise(resolve => setTimeout(resolve, time));

            if (subscribes.lastPrice) {
                setImmediate(async () => {
                    const lp = subscribes.lastPrice[0]((async function* () {
                        while (this.inProgress) {
                            await timer(this.timer);
                            yield subscribes.lastPrice[1]();
                        }
                    }).call(this));

                    for await (const price of lp) {
                        if (price.lastPrice) {
                            this.lastPrice = price.lastPrice.price;
                        }
                    }
                });
            }
        }

        decisionBuy() {
            return Math.floor(Math.random() * 100) > 50;
        }

        // {
        //     orderId: '31271158513',
        //     executionReportStatus: 1,
        //     lotsRequested: 1,
        //     lotsExecuted: 1,
        //     initialOrderPrice: { currency: 'rub', units: 1234, nano: 900000000 },
        //     executedOrderPrice: { currency: 'rub', units: 123, nano: 120000000 },
        //     totalOrderAmount: { currency: 'rub', units: 1231, nano: 200000000 },
        //     initialCommission: { currency: 'rub', units: 0, nano: 310000000 },
        //     executedCommission: { currency: 'rub', units: 0, nano: 0 },
        //     aciValue: { currency: 'rub', units: 0, nano: 0 },
        //     figi: 'BBG004730N88',
        //     direction: 1,
        //     initialSecurityPrice: { currency: 'rub', units: 123, nano: 490000000 },
        //     orderType: 2,
        //     message: '',
        //     initialOrderPricePt: undefined
        //   }

        // {
        //     orderId: '31271365988',
        //     executionReportStatus: 4,
        //     lotsRequested: 1,
        //     lotsExecuted: 0,
        //     initialOrderPrice: { currency: 'rub', units: 1083, nano: 400000000 },
        //     executedOrderPrice: { currency: 'rub', units: 0, nano: 0 },
        //     totalOrderAmount: { currency: 'rub', units: 0, nano: 0 },
        //     initialCommission: { currency: 'rub', units: 0, nano: 280000000 },
        //     executedCommission: { currency: 'rub', units: 0, nano: 0 },
        //     aciValue: { currency: 'rub', units: 0, nano: 0 },
        //     figi: 'BBG004730N88',
        //     direction: 1,
        //     initialSecurityPrice: { currency: 'rub', units: 108, nano: 340000000 },
        //     orderType: 1,
        //     message: '',
        //     initialOrderPricePt: undefined
        //   }

        // {
        //     orders: [
        //       {
        //         orderId: '31271197970',
        //         executionReportStatus: 4,
        //         lotsRequested: 1,
        //         lotsExecuted: 0,
        //         initialOrderPrice: [Object],
        //         executedOrderPrice: [Object],
        //         totalOrderAmount: [Object],
        //         averagePositionPrice: [Object],
        //         initialCommission: [Object],
        //         executedCommission: [Object],
        //         figi: 'BBG004730N88',
        //         direction: 2,
        //         initialSecurityPrice: [Object],
        //         stages: [],
        //         serviceCommission: [Object],
        //         currency: 'RUB',
        //         orderType: 1,
        //         orderDate: 2022-05-11T17:44:19.359Z
        //       },
        //       {
        //         orderId: '31271326321',
        //         executionReportStatus: 4,
        //         lotsRequested: 1,
        //         lotsExecuted: 0,
        //         initialOrderPrice: [Object],
        //         executedOrderPrice: [Object],
        //         totalOrderAmount: [Object],
        //         averagePositionPrice: [Object],
        //         initialCommission: [Object],
        //         executedCommission: [Object],
        //         figi: 'BBG004730N88',
        //         direction: 2,
        //         initialSecurityPrice: [Object],
        //         stages: [],
        //         serviceCommission: [Object],
        //         currency: 'RUB',
        //         orderType: 1,
        //         orderDate: 2022-05-11T17:51:01.327Z
        //       },
        //       {
        //         orderId: '31271365988',
        //         executionReportStatus: 4,
        //         lotsRequested: 1,
        //         lotsExecuted: 0,
        //         initialOrderPrice: [Object],
        //         executedOrderPrice: [Object],
        //         totalOrderAmount: [Object],
        //         averagePositionPrice: [Object],
        //         initialCommission: [Object],
        //         executedCommission: [Object],
        //         figi: 'BBG004730N88',
        //         direction: 1,
        //         initialSecurityPrice: [Object],
        //         stages: [],
        //         serviceCommission: [Object],
        //         currency: 'RUB',
        //         orderType: 1,
        //         orderDate: 2022-05-11T17:53:06.925Z
        //       }
        //     ]
        //   }

        /*
    {"orders":[{"orderId":"31271197970","executionReportStatus":4,"lotsRequested":1,"lotsExecuted":0,"initialOrderPrice":{"currency":"rub","units":1250,"nano":0},"executedOrderPrice":{"currency":"rub","units":0,"nano":0},"totalOrderAmount":{"currency":"rub","units":1250,"nano":0},"averagePositionPrice":{"currency":"rub","units":0,"nano":0},"initialCommission":{"currency":"rub","units":0,"nano":320000000},"executedCommission":{"currency":"rub","units":0,"nano":0},"figi":"BBG004730N88","direction":2,"initialSecurityPrice":{"currency":"rub","units":125,"nano":0},"stages":[],"serviceCommission":{"currency":"rub","units":0,"nano":0},"currency":"RUB","orderType":1,"orderDate":"2022-05-11T17:44:19.359Z"},{"orderId":"31271326321","executionReportStatus":4,"lotsRequested":1,"lotsExecuted":0,"initialOrderPrice":{"currency":"rub","units":1240,"nano":0},"executedOrderPrice":{"currency":"rub","units":0,"nano":0},"totalOrderAmount":{"currency":"rub","units":1240,"nano":0},"averagePositionPrice":{"currency":"rub","units":0,"nano":0},"initialCommission":{"currency":"rub","units":0,"nano":310000000},"executedCommission":{"currency":"rub","units":0,"nano":0},"figi":"BBG004730N88","direction":2,"initialSecurityPrice":{"currency":"rub","units":124,"nano":0},"stages":[],"serviceCommission":{"currency":"rub","units":0,"nano":0},"currency":"RUB","orderType":1,"orderDate":"2022-05-11T17:51:01.327Z"},{"orderId":"31271365988","executionReportStatus":4,"lotsRequested":1,"lotsExecuted":0,"initialOrderPrice":{"currency":"rub","units":1083,"nano":400000000},"executedOrderPrice":{"currency":"rub","units":0,"nano":0},"totalOrderAmount":{"currency":"rub","units":1083,"nano":400000000},"averagePositionPrice":{"currency":"rub","units":0,"nano":0},"initialCommission":{"currency":"rub","units":0,"nano":280000000},"executedCommission":{"currency":"rub","units":0,"nano":0},"figi":"BBG004730N88","direction":1,"initialSecurityPrice":{"currency":"rub","units":108,"nano":340000000},"stages":[],"serviceCommission":{"currency":"rub","units":0,"nano":0},"currency":"RUB","orderType":1,"orderDate":"2022-05-11T17:53:06.925Z"}]}
    */
        async buy() {
            if (!this.buyT && this.lastPrice) {
                this.buyT = 1;
                const orderId = this.genOrderId();

                // console.log(orderId);

                // const q = await this.cb.postOrder(
                //     this.accountId,
                //     this.figi,
                //     1,
                //     {
                //         ...this.lastPrice,
                //         units: this.lastPrice.units - 15,
                //     },
                //     1, // OrderDirection.ORDER_DIRECTION_BUY,
                //     1, // OrderType.ORDER_TYPE_LIMIT,
                //     orderId, //: 'abc-fsdfdsfsdf-2',
                // );

                // console.log(q);
                // console.log(JSON.stringify(await this.cb.getOrders(this.accountId)));
            }
        }

        stop() {
            super.stop();

            // console.log('stopt');
        }
    }

    module.exports.RandomExample = RandomExample;
} catch (e) {}
