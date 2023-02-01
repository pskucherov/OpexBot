#!/usr/bin/env node

try {
    process.env.NODE_ENV = 'production';

    const kill = require('kill-port');
    const { app, BrowserWindow, shell } = require('electron');
    const log = require('electron-log');

    Object.assign(console, log.functions);

    (async () => {
        try {
            await kill(3056, 'tcp');
            await kill(8056, 'tcp');

            if (!process.argv) {
                process.argv = [];
            }

            for (let i = 0; i <= 3; i++) {
                if (typeof process.argv[i] === 'undefined') {
                    process.argv[i] = '';
                }
            }

            process.argv[2] = 'start';
            process.argv[3] = __dirname;
            process.argv[4] = '-p';
            process.argv[5] = '3056';

            require('./src/main');
            require('next/dist/bin/next');

            const createWindow = () => {
                const win = new BrowserWindow({
                    title: 'opexflow.com',
                    width: 1024,
                    height: 768,

                    icon: __dirname + '/icons/o.ico',

                    webPreferences: {
                        webviewTag: true,
                        nativeWindowOpen: true,
                        enableRemoteModule: false,
                    },
                });

                win.removeMenu();
                win.setMenu(null);

                win.loadURL('http://localhost:3056/');

                return win;
            };

            app.whenReady()
                .then(() => {
                    try { // eslint-disable-line promise/always-return
                        const win = createWindow();

                        app.on('activate', () => {
                            if (BrowserWindow.getAllWindows().length === 0) {
                                createWindow();
                            }
                        });

                        win.webContents.setWindowOpenHandler(details => {
                            shell.openExternal(details.url);

                            return { action: 'deny' };
                        });

                        app.on('window-all-closed', async () => {
                            await kill(3056, 'tcp');
                            await kill(8056, 'tcp');

                            if (process.platform !== 'darwin') {
                                app.quit();
                                process.exit(0);
                            }
                        });
                    } catch (e) {
                        console.log(e); // eslint-disable-line no-console
                    }
                })
                .catch(e => {
                    console.log(e); // eslint-disable-line no-console
                    throw e;
                });

            process.on('SIGINT', async () => {
                console.log('SIGINT'); // eslint-disable-line no-console
                await kill(3056, 'tcp');
                await kill(8056, 'tcp');

                process.exit(0);
            });
        } catch (e) {
            console.log(e); // eslint-disable-line no-console
        }
    })();
} catch (e) {
    console.log(e); // eslint-disable-line no-console
}
