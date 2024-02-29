// import { Candles } from '../../components/investAPI/candles';
import { createSdk } from 'tinkoff-sdk-grpc-js';
import { TOKEN } from '../../config';

import { Instruments } from '../../components/investAPI/instruments';
import { logger } from '../../src/utils';

// import { TradeDirection } from 'tinkoff-sdk-grpc-js/dist/generated/marketdata';
// import { Common } from '../../src/Common/TsCommon';

// import { Common } from '../../src/Common/Common';

const sdk = createSdk(TOKEN, 'orderbook', logger);

// const candlesSdk = new Candles(sdk);
const instruments = new Instruments(sdk);

(async () => { // eslint-disable-line
    const allBaseShares = (await instruments.getAllShares()).filter(f => f.currency === 'rub');

    const cachedUidTicker: { [key: string]: string; } = {};

    // const lastTrades: { [key: string]: any; } = {}; // eslint-disable-line @typescript-eslint/no-explicit-any

    // const uids: string[] = [];
    let bidsAll = 0;
    let asksAll = 0;
    const buy = [];
    const sell = [];
    const wait = [];

    for (let i = 0; i < allBaseShares.length; i++) {
        const { uid, ticker, name } = allBaseShares[i];

        // if (ticker !== 'SBER') {
        //     continue;
        // }

        // uids.push(uid);
        cachedUidTicker[uid] = `${name} (${ticker})`;

        const { bids, asks } = (await sdk.marketData.getOrderBook({
            depth: 50,
            instrumentId: uid,
        })) || {};

        // depth: number;
        // bids: Order[];
        // asks: Order[];
        // lastPrice: Quotation | undefined;
        // closePrice: Quotation | undefined;
        // limitUp: Quotation | undefined;
        // limitDown: Quotation | undefined;
        // lastPriceTs: Date | undefined;
        // closePriceTs: Date | undefined;
        // orderbookTs: Date | undefined;

        let bidsQuantity = 0;

        for (let j = 0; j < bids?.length; j++) {
            bidsQuantity += bids[j].quantity;
            bidsAll += bids[j].quantity;
        }

        let asksQuantity = 0;

        for (let j = 0; j < asks?.length; j++) {
            asksQuantity += asks[j].quantity;
            asksAll += asks[j].quantity;
        }

        // asks заявка на продажу
        // bids на покупку
        console.log(cachedUidTicker[uid], bidsQuantity, asksQuantity); // eslint-disable-line no-console
        if (asksQuantity > bidsQuantity * 1.2) {
            console.log('Продавать'); // eslint-disable-line no-console
            sell.push(ticker);
        } else if (bidsQuantity > asksQuantity * 1.2) {
            console.log('Покупать'); // eslint-disable-line no-console
            buy.push(ticker);
        } else {
            console.log('Держать'); // eslint-disable-line no-console
            wait.push(ticker);
        }
    }

    try {
        console.log('Состояние рынка'); // eslint-disable-line no-console
        console.log('Продавать', sell.length, asksAll, 'Ждать', wait.length); // eslint-disable-line no-console
        console.log('Покупать', buy.length, bidsAll); // eslint-disable-line no-console
        console.log(buy); // eslint-disable-line no-console
    } catch (e) {
        console.log(e); // eslint-disable-line
    }
})();
