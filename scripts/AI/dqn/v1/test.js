import * as tf from '@tensorflow/tfjs-node-gpu';

import { ALL_ACTIONS, TradeGame } from './tradegame';

try {
    let game;
    let qNet;

    let cumulativeReward = 0;
    let cumulativeFruits = 0;
    let autoPlayIntervalJob;
    let currentQValues;
    let bestAction;

    /** Reset the game state. */
    async function reset() {
        if (game == null) {
            return;
        }
        game.reset();
        await calcQValuesAndBestAction();
    }

    /**
     * Play a game for one step.
     *
     * - Use the current best action to forward one step in the game.
     * - Accumulate to the cumulative reward.
     * - Determine if the game is over and update the UI accordingly.
     * - If the game has not ended, calculate the current Q-values and best action.
     * - Render the game in the canvas.
     */
    async function step() {
        try {
            const { reward, done, fruitEaten } = game.step(bestAction);

            invalidateQValuesAndBestAction();
            cumulativeReward += reward;
            if (fruitEaten) {
                cumulativeFruits++;
            }

            console.log(`Reward=${cumulativeReward.toFixed(1)}; Fruits=${cumulativeFruits};`); // eslint-disable-line no-console
            console.log(`Balance=${game.balance}; Position=${game.currentPosition}`); // eslint-disable-line no-console
            console.log(); // eslint-disable-line no-console

            if (done) {
                cumulativeReward = 0;
                cumulativeFruits = 0;

                clearInterval(autoPlayIntervalJob);
            }
            await calcQValuesAndBestAction();
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    /** Calculate the current Q-values and the best action. */
    async function calcQValuesAndBestAction() {
        if (currentQValues != null) {
            return;
        }
        tf.tidy(() => {
            try {
                const stateTensor = game.getStateTensor(game.getState(), game.height, game.width);

                // console.log(stateTensor);

                const predictOut = qNet.predict(stateTensor);

                currentQValues = predictOut.dataSync();

                // console.log(currentQValues, ALL_ACTIONS, predictOut.argMax(-1).dataSync()[0]);

                bestAction = ALL_ACTIONS[predictOut.argMax(-1).dataSync()[0]];

                // console.log(bestAction);
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }
        });
    }

    function invalidateQValuesAndBestAction() {
        currentQValues = null;
        bestAction = null;
    }

    const LOCAL_MODEL_URL = 'file://./models/dqn/model.json';

    // const REMOTE_MODEL_URL = 'https://storage.googleapis.com/tfjs-examples/Trade-dqn/dqn/model.json';

    async function initGame() {
        try {
            game = new TradeGame();

            // console.log(game);
            // console.log(game.height, game.width, game.getState);

            // Warm up qNet.
            for (let i = 0; i < 3; ++i) {
                qNet.predict(game.getStateTensor(game.getState(), game.height, game.width));
            }

            await reset();

            autoPlayIntervalJob = setInterval(() => {
                step();
            }, 100);
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    }

    (async function() {
        try {
            qNet = await tf.loadLayersModel(LOCAL_MODEL_URL);

            // loadHostedModelButton.textContent = `Loaded model from ${LOCAL_MODEL_URL}`;

            initGame();
        } catch (err) {
            console.log(err); // eslint-disable-line no-console
            console.log('Loading local model failed.'); // eslint-disable-line no-console

            // loadHostedModelButton.disabled = false;
        }
    })();
} catch (err) {
    console.log(err); // eslint-disable-line no-console
}
