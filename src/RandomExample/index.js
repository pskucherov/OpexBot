const { Common } = require('../Common');

/**
 * Торговый робот без логики со случайным срабатыванием.
 * Работает только на покупку, дальше ждёт исполнения заявки.
 * После исполнения заявки ждёт выхода по TP или SP.
 */
class RandomExample extends Common {
    decisionBuy() {
        return Math.floor(Math.random() * 100) > 50;
    }
}

module.exports.RandomExample = RandomExample;
