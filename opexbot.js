#!/usr/bin/env node
const path = require('path');
const concurrently = require('concurrently');
const { app, BrowserWindow } = require('electron');

(async () => {
    const { result } = await concurrently([
        { command: 'npx next start', name: 'opexviewer' },
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

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
})();
