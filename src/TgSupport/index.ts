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

        constructor(...args: any) { // eslint-disable-line
            super(...args);

            this.type = Bot.type;
            this.isPortfolio = true;
            this.name = name;

            (async () => {
                this.init();
                this.initAsync();
            })();

            this.subscribeTgEvents();
        }

        async subscribeTgEvents() {
            if (!this.tgBot) {
                return;
            }

            this.tgBot.onText(/счёт|счет/igm, () => {
                console.log('счет или счёт'); // eslint-disable-line
            });
        }

        async sendTgEvents(type: string) {
            if (type === 'sellAll') {
                this.tgBot.sendMessage('Начата продажа портфеля.');
            }
        }

        start() {
            this.tgBot.sendMessage('TgSupport запущен.');

            // Переопределяем start, чтобы не выполнялась подписка и прочее получение информации.
        }
    }

    if (name) {
        module.exports[name] = Bot;
    }
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
