/* eslint-disable no-console */
try {
    const { Backtest } = require('../Common/Backtest');
    const spawn = require('child_process').spawn;

    const path = require('path');
    const name = __dirname.split(path.sep).pop();

    /**
     * Заготовка торгового робота.
     */
    class Bot extends Backtest {
        constructor(...args) {
            super(...args);
            this.name = name;
        }

        // Очищаем обработчики на JS,
        // чтобы не занимали стримы.
        subscribes() {}
        processing() {}

        start() {
            console.log('start py');

            try {
                this.pyProcess = spawn('python', [path.resolve(__dirname, './bot.py'),
                    this.token,
                    JSON.stringify(this),
                ]);

                this.pyProcess.stdout.on('data', data => {
                    console.log(data.toString());
                });

                // setInterval(() => {
                //     this.pyProcess.stdin.write(String(Math.random()));
                // }, 500);
            } catch (e) { console.log(e) }
        }

        stop() {
            console.log('stop py');
            try {
                this.pyProcess.stdin.pause();
                this.pyProcess.kill();
            } catch (e) { console.log(e) }
        }
    }

    module.exports[name] = Bot;
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
