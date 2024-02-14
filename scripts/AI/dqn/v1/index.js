import * as fs from 'fs';

import { mkdir } from 'shelljs';
import { TradeGameAgent } from './agent';
import { copyWeights } from './dqn';

import { TradeGame } from './tradegame';

// TODO(cais): Tune these parameters.
export const NO_FRUIT_REWARD = -0.2;
export const FRUIT_REWARD = 10;
export const DEATH_REWARD = -20;

// TODO(cais): Explore adding a "bad fruit" with a negative reward.

export const ACTION_GO_STRAIGHT = 0;
export const ACTION_SELL = -1;
export const ACTION_BUY = 1;

export const ALL_ACTIONS = [ACTION_GO_STRAIGHT, ACTION_SELL, ACTION_BUY];
export const NUM_ACTIONS = ALL_ACTIONS.length;

const tf = require('@tensorflow/tfjs-node-gpu');

class MovingAverager {
    constructor(bufferLength) {
        this.buffer = [];
        for (let i = 0; i < bufferLength; ++i) {
            this.buffer.push(null);
        }
    }

    append(x) {
        this.buffer.shift();
        this.buffer.push(x);
    }

    average() {
        return this.buffer.reduce((x, prev) => x + prev) / this.buffer.length;
    }
}

const gamma = 0.99;
const cumulativeRewardThreshold = 10000;
const maxNumFrames = 1e6;
const syncEveryFrames = 1e3;
const savePath = './models/dqn';

const game = new TradeGame();

const learningRate = 1e-3;
const replayBufferSize = 1e4;
const epsilonInit = 0.5;
const epsilonFinal = 0.01;
const epsilonDecayFrames = 1e5;
const batchSize = 512;

const agent = new TradeGameAgent(game, {
    replayBufferSize,
    epsilonInit,
    epsilonFinal,
    epsilonDecayFrames,
    learningRate,
});

(async () => {
    try {
        for (let i = 0; i < agent.replayBufferSize; ++i) {
            agent.playStep();
        }

        // Moving averager: cumulative reward across 100 most recent 100 episodes.
        const rewardAverager100 = new MovingAverager(100);

        // Moving averager: fruits balance across 100 most recent 100 episodes.
        const balanceAverager100 = new MovingAverager(100);

        const optimizer = tf.train.adam(learningRate);
        let tPrev = new Date().getTime();
        let frameCountPrev = agent.frameCount;
        let averageReward100Best = -Infinity;

        while (true) { // eslint-disable-line
            agent.trainOnReplayBatch(batchSize, gamma, optimizer);

            const { cumulativeReward, done, fruitsEaten } = agent.playStep();

            if (done) {
                const t = new Date().getTime();
                const framesPerSecond =
                    (agent.frameCount - frameCountPrev) / (t - tPrev) * 1e3;

                tPrev = t;
                frameCountPrev = agent.frameCount;

                rewardAverager100.append(cumulativeReward);
                balanceAverager100.append(fruitsEaten);
                const averageReward100 = rewardAverager100.average();
                const averageBalance100 = balanceAverager100.average();

                console.log( // eslint-disable-line no-console
                    `Frame #${agent.frameCount}: ` +
                    `cumulativeReward100=${averageReward100.toFixed(1)}; ` +
                    `balance100=${averageBalance100.toFixed(2)} ` +
                    `(epsilon=${agent.epsilon.toFixed(3)}) ` +
                    `(${framesPerSecond.toFixed(1)} frames/s)`);

                if (averageReward100 >= cumulativeRewardThreshold ||
                    agent.frameCount >= maxNumFrames) {
                    break;
                }

                if (averageReward100 > averageReward100Best) {
                    averageReward100Best = averageReward100;
                    if (savePath != null) { // eslint-disable-line
                        if (!fs.existsSync(savePath)) { // eslint-disable-line
                            mkdir('-p', savePath);
                        }

                        await agent.onlineNetwork.save(`file://${savePath}`);
                    }
                }
            }
            if (agent.frameCount % syncEveryFrames === 0) {
                copyWeights(agent.targetNetwork, agent.onlineNetwork);

                console.log('Sync\'ed weights from online network to target network'); // eslint-disable-line no-console
            }
        }
    } catch (e) {
        console.log(e); // eslint-disable-line no-console
    }
})();

setInterval(() => { }, 5000);
