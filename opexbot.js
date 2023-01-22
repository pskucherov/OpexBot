#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const kill = require('kill-port');
const concurrently = require('concurrently');
const { app, BrowserWindow } = require('electron');

// Opexviewer лежит рядом с opexbot
const moduleDist = path.join('../', 'OpexViewer');

// Opexviewer лежит внутри node_modules
const packageDist = path.join('./', 'node_modules', 'OpexViewer');
const viewerDir = fs.existsSync(moduleDist) ? moduleDist : packageDist;

(async () => {
    await kill(3000, 'tcp');
    await kill(8000, 'tcp');

    concurrently([
        { command: `npx next start ${viewerDir}`, name: 'opexviewer' },
        { command: 'node src/main', name: 'opexbot' },
    ], {
        prefix: 'name',
        killOthers: ['failure', 'success'],
        restartTries: 3,
        cwd: path.resolve(__dirname),
    });

    const createWindow = () => {
        const win = new BrowserWindow({
            width: 800,
            height: 600,
        });

        win.loadURL('http://localhost:3000/');
    };

    app.whenReady()
        .then(() => { // eslint-disable-line promise/always-return
            createWindow();
            app.on('activate', () => {
                if (BrowserWindow.getAllWindows().length === 0) createWindow();
            });
        })
        .catch(() => null);

    app.on('window-all-closed', async () => {
        await kill(3000, 'tcp');
        await kill(8000, 'tcp');

        if (process.platform !== 'darwin') {
            app.quit();
            process.exit(0);
        }
    });

    process.on('SIGINT', async () => {
        await kill(3000, 'tcp');
        await kill(8000, 'tcp');

        process.exit(0);
    });
})();
