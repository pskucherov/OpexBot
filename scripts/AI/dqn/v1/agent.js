import * as tf from '@tensorflow/tfjs-node-gpu';

import { createDeepQNetwork } from './dqn';
import { getRandomAction, NUM_ACTIONS, ALL_ACTIONS } from './tradegame';
import { ReplayMemory } from './replay_memory';
import { assertPositiveInteger } from './utils';

export class TradeGameAgent {
    /**
     * Constructor of TradeGameAgent.
     *
     * @param {TradeGame} game A game object.
     * @param {object} config The configuration object with the following keys:
     *   - `replayBufferSize` {number} Size of the replay memory. Must be a
     *     positive integer.
     *   - `epsilonInit` {number} Initial value of epsilon (for the epsilon-
     *     greedy algorithm). Must be >= 0 and <= 1.
     *   - `epsilonFinal` {number} The final value of epsilon. Must be >= 0 and
     *     <= 1.
     *   - `epsilonDecayFrames` {number} The # of frames over which the value of
     *     `epsilon` decreases from `episloInit` to `epsilonFinal`, via a linear
     *     schedule.
     *   - `learningRate` {number} The learning rate to use during training.
     */
    constructor(game, config) {
        assertPositiveInteger(config.epsilonDecayFrames);

        this.game = game;

        this.epsilonInit = config.epsilonInit;
        this.epsilonFinal = config.epsilonFinal;
        this.epsilonDecayFrames = config.epsilonDecayFrames;
        this.epsilonIncrement_ = (this.epsilonFinal - this.epsilonInit) /
            this.epsilonDecayFrames;

        this.onlineNetwork =
            createDeepQNetwork(game.height, game.width, NUM_ACTIONS);
        this.targetNetwork =
            createDeepQNetwork(game.height, game.width, NUM_ACTIONS);

        // Freeze taget network: it's weights are updated only through copying from
        // the online network.
        this.targetNetwork.trainable = false;

        this.optimizer = tf.train.adam(config.learningRate);

        this.replayBufferSize = config.replayBufferSize;
        this.replayMemory = new ReplayMemory(config.replayBufferSize);
        this.frameCount = 0;
        this.reset();
    }

    reset() {
        this.cumulativeReward_ = 0;
        this.fruitsEaten_ = 0;
        this.game.reset();
    }

    /**
     * Play one step of the game.
     *
     * @returns {number | null} If this step leads to the end of the game,
     *   the total reward from the game as a plain number. Else, `null`.
     */
    playStep() {
        this.epsilon = this.frameCount >= this.epsilonDecayFrames ?
            this.epsilonFinal :
            this.epsilonInit + this.epsilonIncrement_ * this.frameCount;
        this.frameCount++;

        // The epsilon-greedy algorithm.
        let action;
        const state = this.game.getState();

        if (Math.random() < this.epsilon) {
            // Pick an action at random.
            action = getRandomAction();
        } else {
            tf.tidy(() => {
                const stateTensor =
                    this.game.getStateTensor(state, this.game.height, this.game.width);

                action = ALL_ACTIONS[
                    this.onlineNetwork.predict(stateTensor).argMax(-1).dataSync()[0]
                ];
            });
        }

        const { state: nextState, reward, done, fruitEaten } = this.game.step(action);

        this.replayMemory.append([state, action, reward, done, nextState]);

        this.cumulativeReward_ += reward;
        if (fruitEaten) {
            this.fruitsEaten_++;
        }
        const output = {
            action,
            cumulativeReward: this.cumulativeReward_,
            done,
            fruitsEaten: this.fruitsEaten_,
        };

        if (done) {
            this.reset();
        }

        // console.log(output);
        return output;
    }

    /**
     * Perform training on a randomly sampled batch from the replay buffer.
     *
     * @param {number} batchSize Batch size.
     * @param {number} gamma Reward discount rate. Must be >= 0 and <= 1.
     * @param {tf.train.Optimizer} optimizer The optimizer object used to update
     *   the weights of the online network.
     */
    trainOnReplayBatch(batchSize, gamma, optimizer) {
        try {
            const batch = this.replayMemory.sample(batchSize);

            const lossFunction = () => tf.tidy(() => {
                try {
                    // console.time('lossFunction');

                    // console.time('getStateTensor');
                    const stateTensor = this.game.getStateTensor(
                        batch.map(example => example[0]), this.game.height, this.game.width);

                    // console.timeEnd('getStateTensor');

                    // console.log('trainOnReplayBatch 3');
                    const actionTensor = tf.tensor1d(
                        batch.map(example => example[1]), 'int32');

                    // console.log('stateTensor');
                    // stateTensor.print();
                    // console.log('actionTensor');
                    // actionTensor.print();
                    // console.log(NUM_ACTIONS);

                    // tf.oneHot(tf.tensor1d([0, 1, 2], 'int32'), 3).print();

                    // console.time('tf.oneHot');
                    const a = tf.oneHot(actionTensor, NUM_ACTIONS);

                    // console.log();
                    // console.log('aprint');
                    // actionTensor.print();
                    // a.print();
                    // console.log(NUM_ACTIONS);
                    // stateTensor.print();

                    // console.log('trainOnReplayBatch 4');
                    // stateTensor.print();
                    const b = this.onlineNetwork.apply(stateTensor, { training: true });

                    // b.print();

                    const c = b.mul(a);

                    // c.print();

                    const qs = c.sum(-1);

                    // console.log('const qs = c.sum');
                    // qs.print();

                    const rewardTensor = tf.tensor1d(batch.map(example => example[2]));

                    // console.log('batch', JSON.stringify(batch[0], null, 4), JSON.stringify(batch[4], null, 4));
                    // console.log('trainOnReplayBatch 5');
                    // rewardTensor.print();
                    const nextStateTensor = this.game.getStateTensor(
                        batch.map(example => example[4]), this.game.height, this.game.width);

                    // console.timeEnd('tf.oneHot');
                    // console.log('nextStateTensor');
                    // nextStateTensor.print();

                    // console.time('tf.qwef');
                    const nextMaxQTensor =
                        this.targetNetwork.predict(nextStateTensor).max(-1);

                    // nextMaxQTensor.print();
                    const doneMask = tf.scalar(1).sub(
                        tf.tensor1d(batch.map(example => example[3])).asType('float32'));

                    // console.log('trainOnReplayBatch 6');

                    // doneMask.print();

                    const targetQs = rewardTensor.add(nextMaxQTensor.mul(doneMask).mul(gamma));

                    // const targetQs = rewardTensor.add(nextMaxQTensor.mul(gamma));

                    // console.log('trainOnReplayBatch 7');
                    // targetQs.print();
                    // console.log('targetQs');
                    // targetQs.print();

                    // console.log('qs');
                    // qs.print();
                    // console.timeEnd('tf.qwef');
                    // // console.log('trainOnReplayBatch 8');
                    // if (Math.random() < 0.005) {
                    //     qwef.print();
                    // }

                    // console.timeEnd('lossFunction');

                    return tf.losses.meanSquaredError(targetQs, qs);
                } catch (e) {
                    console.log(e); // eslint-disable-line no-console
                }
            });

            // console.log('trainOnReplayBatch 88');

            // Calculate the gradients of the loss function with repsect to the weights
            // of the online DQN.
            // console.time('tf.variableGrads');
            const grads = tf.variableGrads(lossFunction);

            // console.timeEnd('tf.variableGrads');

            // Use the gradients to update the online DQN's weights.
            // console.log('trainOnReplayBatch 9');

            // console.log('grads', grads);
            // console.log('grads ^^^ \r\n\r\n');
            // console.time('tf.applyGradients');
            optimizer.applyGradients(grads.grads);

            // console.timeEnd('tf.applyGradients');

            // console.log('trainOnReplayBatch 99');
            // console.time('tf.dispose');
            tf.dispose(grads);

            // console.timeEnd('tf.dispose');

            // console.log('trainOnReplayBatch 10');

            // TODO(cais): Return the loss value here?
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }
}
