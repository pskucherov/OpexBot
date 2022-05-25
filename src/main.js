const fs = require('fs');
const path = require('path');

const hmr = require('node-hmr');

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

        if (fs.lstatSync(p).isDirectory() && !['Common', 'Example'].includes(file)) {
            const module = require(p);

            if (module[file]) {
                bots[file] = module[file];
            }
        }
    });

    const { connector } = require('tinkofftradingbotconnector');

    connector({ bots });

    exports.bots = bots;
}, {
    watchDir: './',
    watchFilePatterns: ['**/*.js'],
});
