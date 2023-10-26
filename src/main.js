process.setMaxListeners(0);

const sqlite3 = require('sqlite3');

sqlite3.verbose();

const { open } = require('sqlite');

const fs = require('fs');
const path = require('path');

const hmr = require('node-hmr');
const { getDBPath, createTables, StatisticsTables } = require('../db/tables');

// this is a top-level await
(async () => {
    // open the database
    const db = await open({
        filename: getDBPath(),
        driver: sqlite3.Database,
    });

    await createTables(db);

    /**
     * Подключает все папки из текущей директории.
     *
     * При изменении в файлах перезагружает роботов,
     * чтобы не перезапускать сервис при правках.
     */
    hmr(() => {
        console.log('hmr started'); // eslint-disable-line no-console

        const bots = {};

        fs.readdirSync(path.resolve(__dirname)).forEach(file => {
            const p = path.resolve(__dirname, file);

            if (fs.lstatSync(p).isDirectory() && file !== 'Common' &&
                file !== 'Example' && file !== 'Buyer') {
                const module = require(p);

                if (module[file]) {
                    bots[file] = module[file];
                }
            }
        });

        const { tradingbotconnector } = require('tinkofftradingbotconnector');

        tradingbotconnector({
            bots,
            robotsStarted: [],
        }, {
            db,
            statisticsTables: new StatisticsTables(db),
        });

        exports.bots = bots;
    }, {
        watchDir: './',
        watchFilePatterns: ['**/*.js'],
    });
})();

setInterval(() => {}, 3600000);
