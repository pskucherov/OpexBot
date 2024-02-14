import * as tf from '@tensorflow/tfjs-node-gpu';

import { getRandomInteger } from './utils';

// TODO(cais): Tune these parameters.
export const NO_FRUIT_REWARD = -0.2;
export const FRUIT_REWARD = 10;
export const DEATH_REWARD = -20;

// TODO(cais): Explore adding a "bad fruit" with a negative reward.

export const ACTION_GO_STRAIGHT = 0;
export const ACTION_SELL = 1;
export const ACTION_BUY = 2;

export const ALL_ACTIONS = [ACTION_GO_STRAIGHT, ACTION_SELL, ACTION_BUY];
export const NUM_ACTIONS = ALL_ACTIONS.length;

/**
 * Generate a random action among all possible actions.
 *
 * @return {0 | 1 | 2} Action represented as a number.
 */
export function getRandomAction() {
    return getRandomInteger(0, NUM_ACTIONS);
}

const trade = [
    [10, 5, 1, 0],
    [50, 20, 1, 0],
    [100, 3, -1, 0],
    [40, 20, 1, 0],
    [80, 10, -1, 0],
    [120, 3, 1, 0],
    [110, 0, 0, 0],
    [110, 0, 0, 0],
    [130, 5, 1, 0],

    // [10, 50, 100, 40, 80, 120, 110, 110, 130], // price
    // [5, 20, 3, 20, 10, 3, 0, 0, 5], // volume
    // [1, 1, -1, 1, -1, 1, 0, 0, 1], // buy / sell marker
    // [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

const emptyState = [
    Array(4).fill(0),
    Array(4).fill(0),
    Array(4).fill(0),
    Array(4).fill(0),
    Array(4).fill(0),
    Array(4).fill(0),
    Array(4).fill(0),
    Array(4).fill(0),
    Array(4).fill(0),
];

const h = 9;
const w = 4;

export class TradeGame {
    height = h;
    width = w;

    constructor() {
        this.reset();
    }

    getDataFromTrades() {
        this.currentBuySellBin = trade[this.currentStep][2];
        this.currentPrice = trade[this.currentStep][0];
        this.currentQuantity = trade[this.currentStep][1];
    }

    reset() {
        this.balance = 1000;
        this.comission = 6;

        this.currentStep = 0;
        this.currentPosition = 0;
        this.currentAvgPrice = 0;
        this.currentPrice = 0;
        this.comissionPaied = 0;

        this.getDataFromTrades();

        this.lastStep = trade.length;
        this.emptySteps = true;

        this.currentState = [...emptyState];
    }

    getState() {
        this.currentState[this.currentStep] = [
            this.balance, this.currentPosition,
            this.currentQuantity, this.currentPrice,
        ];

        return [this.currentState.slice()];
    }

    step(action) {
        const lots = 1;
        let done = false;
        const startPosition = this.currentPosition;
        const startBalance = this.balance;

        this.getDataFromTrades();

        if (action) {
            this.emptySteps = false;

            const val = this.currentPrice * lots;
            const comission = this.comission * lots;

            this.balance -= comission;

            this.comissionPaied += comission;

            if (action === ACTION_SELL && this.currentPosition > 0 ||
                action === ACTION_BUY && this.currentPosition < 0) {
                this.currentAvgPrice = Math.abs(this.currentPosition) * this.currentAvgPrice + this.currentPrice * lots;
            }

            // sell
            if (action === ACTION_SELL) {
                if (this.currentPosition > 0) {
                    this.balance += val;
                    this.currentPosition -= lots;
                } else {
                    // this.balance -= val;
                }
            } else {
                if (this.currentPosition < 0) {
                    this.balance += val;
                } else {
                    this.balance -= val;
                }

                this.currentPosition += lots;
            }
        } else {
            // ++this.emptySteps;
        }

        if ((this.lastStep - 1) === this.currentStep && (this.currentPosition || this.emptySteps) ||
            startPosition && !this.currentPosition && startBalance > this.balance ||

            // this.balance + (this.currentPosition * this.currentPrice) < 100 ||
            this.balance < 20
        ) {
            done = true;
        }

        let reward = NO_FRUIT_REWARD;

        let fruitEaten = false;

        if (done) {
            return { reward: DEATH_REWARD, done, fruitEaten };
        }

        if (//startPosition || !this.currentPosition
            this.balance > 1000
        ) {
            fruitEaten = true;
            reward = FRUIT_REWARD;
        }

        if (// startPosition || !this.currentPosition
            // this.balance > 1000 &&
            this.balance > startBalance
        ) {
            fruitEaten = true;
            reward += FRUIT_REWARD;
        }

        if ((this.lastStep - 1) === this.currentStep) {
            done = true;
        }

        ++this.currentStep;
        const state = this.getState();

        // console.log(reward, state, done, fruitEaten);

        if (done && this.balance > 1000) {
            // console.log(state);
            return { reward, done, fruitEaten };
        }

        return { reward, state, done, fruitEaten };
    }

    getStateTensor(state, h, w) {
        if (!Array.isArray(state)) {
            state = [state];
        }

        const numExamples = state.length;

        const buffer = tf.buffer([numExamples, h, w, 2]);

        for (let n = 0; n < numExamples; ++n) {
            let s = state[n];

            if (state[n] == null) {
                continue;
            }

            if (typeof state[n][0][0] !== 'number') {
                s = state[n][0];
            }

            trade.forEach((t, i) => {
                t.forEach((d, j) => {
                    // buffer.set(normalize2(d, -10, 1400), n, i, j, 0);
                    buffer.set(d, n, i, j, 0);
                });
            });

            s.forEach((t, i) => {
                t.forEach((d, j) => {
                    buffer.set(d, n, i, j, 1);
                });
            });
        }

        return buffer.toTensor();
    }
}

// function normalize1(data, defMin, defMax) {
//     const max = defMax || data.max();
//     const min = defMin || data.min();

//     return {
//         max,
//         min,
//         normalized: data.sub(min).div(max.sub(min)),
//     };
// }

// function normalize2(data) {
//     return data;

//     // const max = defMax;
//     // const min = defMin;

//     // return (data - min) / (max - min);
// }
