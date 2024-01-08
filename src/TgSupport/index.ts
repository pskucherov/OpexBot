try {
    const { Backtest } = require('../Common/TsBacktest');

    const path = require('path');
    const name = __dirname.split(path.sep).pop();

    /**
     * Заготовка торгового робота.
     */
    class Bot extends Backtest {
        // instrument — торгует одним инструментом. portfolio — всем портфелем.
        static type = 'instrument';

        constructor(...args: any) {
            super(...args);

            this.type = Bot.type;
            this.isPortfolio = true;
            this.name = name;

            this.subscribeTgEvents();
        }

        async subscribeTgEvents() {
            if (!this.tgBot) {
                return;
            }

            this.tgBot.onText(/счёт|счет/igm, () => {
                console.log('счет или счёт');
            });
        }

        async sendTgEvents(type: string) {
            if (type === 'sellAll') {
                this.tgBot.sendMessage('Начата продажа портфеля.');
            }
        }
    }

    if (name) {
        module.exports[name] = Bot;
    }
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
