// @ts-nocheck
/* eslint @typescript-eslint/no-explicit-any: 0 */

import { Candles } from '../../../components/investAPI/candles';
import { createSdk } from 'tinkoff-sdk-grpc-js';
import { TOKEN } from '../../../config';

import { Instruments } from '../../../components/investAPI/instruments';
import { logger } from '../../../src/utils';

import { Common } from '../../../src/Common/Common';
import * as tf from '@tensorflow/tfjs-node'; // eslint-disable-line import/no-unresolved
tf.enableProdMode();

const sdk = createSdk(TOKEN, 'backtester', logger);
const candlesSdk = new Candles(sdk);
const instruments = new Instruments(sdk);
const cachedUidTicker: any = {};

(async () => {
    const allBaseShares = (await instruments.getAllShares()).filter(f => f.currency === 'rub');

    const to = new Date();
    const from = new Date();

    from.setDate(from.getDate() - 30);

    for (let i = 0; i < allBaseShares.length; i++) {
        const { uid, ticker, name } = allBaseShares[i];

        if (
            ticker !== 'RTKMP' &&
            ticker !== 'SBER'
        ) {
            continue;
        }

        cachedUidTicker[uid] = `${name} (${ticker})`;

        const historicCandlesArr = await candlesSdk.getCandles(
            {
                instrumentId: uid,
                interval: sdk.CandleInterval.CANDLE_INTERVAL_2_HOUR,
                from,
                to,
            },
        );

        console.log(i, ticker, name, historicCandlesArr.length); // eslint-disable-line no-console

        const dataRaw = [];

        for (let j = 0; j < historicCandlesArr.length; j++) {
            const { close, time } = historicCandlesArr[j];

            dataRaw.push({
                timestamp: new Date(time).getTime(),
                price: Common.getPrice(close),
            });
        }

        const windowSize = 20;

        console.time('calc SMA'); // eslint-disable-line
        const smaVec = ComputeSMA(dataRaw, windowSize);

        console.timeEnd('calc SMA'); // eslint-disable-line

        // console.log('sma', sma);

        const epochLoss = []; // eslint-disable-line

        const inputs = smaVec.map(function(inpF) {
            return inpF['set'].map(function(val) { return val['price'] });
        });
        const outputs = smaVec.map(function(outpF) { return outpF['avg'] });

        const trainingsize = 98;
        const nEpochs = 10;
        const learningrate = 0.01;
        const nHiddenlayers = 4;

        inputs = inputs.slice(0, Math.floor(trainingsize / 100 * inputs.length));
        outputs = outputs.slice(0, Math.floor(trainingsize / 100 * outputs.length));

        const callback = function(epoch, log) {
            epochLoss.push(log.loss);
            console.log('epoch', epoch, 'log.loss', log.loss); // eslint-disable-line
        };

        console.time('calc result'); // eslint-disable-line
        const result = await trainModel(inputs, outputs, windowSize, nEpochs, learningrate, nHiddenlayers, callback);

        console.timeEnd('calc result'); // eslint-disable-line

        console.time('end'); // eslint-disable-line

        // Validate
        let inputs = smaVec.map(function(inpF) {
            return inpF['set'].map(function(val) { return val['price'] });
        });

        // validate on training
        // const valTrainX = inputs.slice(0, Math.floor(trainingsize / 100 * inputs.length));

        // const valTrainY = makePredictions(valTrainX, result['model'], result['normalize']);

        // validate on unseen
        // const valUnseenX = inputs.slice(Math.floor(trainingsize / 100 * inputs.length), inputs.length);

        // const valUnseenY = makePredictions(valUnseenX, result['model'], result['normalize']);

        // const timestampsA = dataRaw.map(function (val) { return val['timestamp'] });
        // const timestampsB = dataRaw.map(function (val) {
        //     return val['timestamp'];
        // }).splice(windowSize, (dataRaw.length - Math.floor((100 - trainingsize) / 100 * dataRaw.length))); //.splice(windowSize, dataRaw.length);

        // const timestampsC = dataRaw.map(function (val) {
        //     return val['timestamp'];
        // }).splice(windowSize + Math.floor(trainingsize / 100 * inputs.length), inputs.length);

        let sma = smaVec.map(function(val) { return val['avg'] });

        // const prices = dataRaw.map(function (val) { return val['price'] });

        sma = sma.slice(0, Math.floor(trainingsize / 100 * sma.length));

        // console.log('sma', sma);
        // console.log('prices', prices);
        // console.log('valTrainY', valTrainY);
        // console.log('valUnseenY', valUnseenY);

        // predict

        let inputs = smaVec.map(function(inpF) {
            return inpF['set'].map(function(val) { return val['price'] });
        });
        let predX = [inputs[inputs.length - 1]];

        predX = predX.slice(Math.floor(trainingsize / 100 * predX.length), predX.length);
        const predY = makePredictions(predX, result['model'], result['normalize']);

        // console.log('predX', predX, 'predY', predY);

        const lastPrice = Common.getPrice(historicCandlesArr[historicCandlesArr.length - 1].close);
        const pred = predY?.[0];

        console.log('lastPrice', lastPrice, 'predict', pred, '%', (pred - lastPrice) / lastPrice); // eslint-disable-line
        console.timeEnd('end'); // eslint-disable-line
    }
})();

function ComputeSMA(data, windowSize = 20) {
    const rAvgs = [];

    // avgPrev = 0;

    for (let i = 0; i <= data.length - windowSize; i++) {
        const t = i + windowSize;
        let currAvg = 0.00;

        for (let k = i; k < t && k <= data.length; k++) {
            currAvg += data[k]['price'] / windowSize;
        }
        rAvgs.push({ set: data.slice(i, i + windowSize), avg: currAvg });

        // avgPrev = currAvg;
    }

    return rAvgs;
}

async function trainModel(X, Y, windowSize, nEpochs, learningRate, nLayers, callback) { // eslint-disable-line
    const batchSize = 32;

    // input dense layer
    const inputLayerShape = windowSize;
    const inputLayerNeurons = 64;

    // LSTM
    const rnnInputLayerFeatures = 16;
    const rnnInputLayerTimesteps = inputLayerNeurons / rnnInputLayerFeatures;
    const rnnInputShape = [rnnInputLayerFeatures, rnnInputLayerTimesteps]; // the shape have to match input layer's shape
    const rnnOutputNeurons = 16; // number of neurons per LSTM's cell

    // output dense layer
    const outputLayerShape = rnnOutputNeurons; // dense layer input size is same as LSTM cell
    const outputLayerNeurons = 1; // return 1 value

    const inputTensor = tf.tensor2d(X, [X.length, X[0].length]);
    const labelTensor = tf.tensor2d(Y, [Y.length, 1]).reshape([Y.length, 1]);

    const [xs, inputMax, inputMin] = normalizeTensorFit(inputTensor);
    const [ys, labelMax, labelMin] = normalizeTensorFit(labelTensor);

    // ## define model

    const model = tf.sequential();

    model.add(tf.layers.dense({ units: inputLayerNeurons, inputShape: [inputLayerShape] }));
    model.add(tf.layers.reshape({ targetShape: rnnInputShape }));

    const lstmCells = [];

    for (let index = 0; index < nLayers; index++) {
        lstmCells.push(tf.layers.lstmCell({ units: rnnOutputNeurons }));
    }

    model.add(tf.layers.rnn({
        cell: lstmCells,
        inputShape: rnnInputShape,
        returnSequences: false,
    }));

    model.add(tf.layers.dense({ units: outputLayerNeurons, inputShape: [outputLayerShape] }));

    model.compile({
        optimizer: tf.train.adam(learningRate),
        loss: 'meanSquaredError',
    });

    // ## fit model

    const hist = await model.fit(xs, ys,
        {
            batchSize: batchSize, epochs: nEpochs, callbacks: {
                onEpochEnd: async (epoch, log) => {
                    callback(epoch, log);
                },
            },
            verbose: 0,
        });

    // return { model: model, stats: hist };
    return {
        model: model, stats: hist,
        normalize: {
            inputMax: inputMax, inputMin: inputMin, labelMax: labelMax,
            labelMin: labelMin,
        },
    };
}

function makePredictions(X, model, dictNormalize) {
    // const predictedResults = model.predict(tf.tensor2d(X, [X.length, X[0].length]).div(tf.scalar(10))).mul(10); // old method

    X = tf.tensor2d(X, [X.length, X[0].length]);
    const normalizedInput = normalizeTensor(X, dictNormalize['inputMax'], dictNormalize['inputMin']);
    const modelOut = model.predict(normalizedInput);
    const predictedResults = unNormalizeTensor(modelOut, dictNormalize['labelMax'], dictNormalize['labelMin']);

    return Array.from(predictedResults.dataSync());
}

function normalizeTensorFit(tensor) {
    const maxval = tensor.max();
    const minval = tensor.min();
    const normalizedTensor = normalizeTensor(tensor, maxval, minval);

    return [normalizedTensor, maxval, minval];
}

function normalizeTensor(tensor, maxval, minval) {
    return tensor.sub(minval).div(maxval.sub(minval));
}

function unNormalizeTensor(tensor, maxval, minval) {
    return tensor.mul(maxval.sub(minval)).add(minval);
}
