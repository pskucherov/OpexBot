const fs = require('fs');
const path = require('path');
const hmr = require('node-hmr');

/**
 * Подключает все папки из текущей директории.
 *
 * При изменении в файлах перезагружает роботов,
 * чтобы не перезапускать сервис при правках робота.
 */
hmr(() => {
    const bots = {};

    fs.readdirSync(path.resolve(__dirname)).forEach(file => {
        const p = path.resolve(__dirname, file);

        if (fs.lstatSync(p).isDirectory() && file !== 'Common') {
            const module = require(p);

            if (module[file]) {
                bots[file] = module[file];
            }
        }
    });

    exports.bots = bots;
}, {
    watchDir: './',
    watchFilePatterns: ['**/*.js'],
});