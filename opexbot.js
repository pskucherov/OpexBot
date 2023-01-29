#!/usr/bin/env node

try {
    process.env.NODE_ENV = 'production';

    const fs = require('fs');
    const path = require('path');
    const kill = require('kill-port');
    const concurrently = require('concurrently');
    const { app, BrowserWindow, shell } = require('electron');
    const log = require('electron-log');

    // const {nextStart} = require('next/dist/cli/next-start');

    Object.assign(console, log.functions);

    // Opexviewer лежит рядом с opexbot
    // const moduleDist = path.join('../', 'OpexViewer');

    // // Opexviewer лежит внутри node_modules
    // const packageDist = path.join('./', 'node_modules', 'opexviewer');
    const packageDist2 = path.resolve(__dirname, 'node_modules', 'opexviewer');

    // console.log('packageDist2 3', packageDist2);

    // const viewerDir = fs.existsSync(moduleDist) ? moduleDist : packageDist;

    // const nextBin = path.resolve(path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next'));
    // const mainFile = path.resolve(path.join(__dirname, 'src', 'main.js'));

    // const nextBin1 = path.join('node_modules', 'next', 'dist', 'bin', 'next');
    // const mainFile1 = path.join('src', 'main.js');

    // console.log(nextBin, fs.existsSync(nextBin));
    // console.log(mainFile, fs.existsSync(mainFile));
    // console.log(nextBin1, fs.existsSync(nextBin));
    // console.log(mainFile1, fs.existsSync(mainFile));

    // const p1 = path.resolve(path.join('./', 'src', 'main.js'));
    // const p2 = path.join('./', 'src', 'main.js');
    // console.log(p1, fs.existsSync(p1));
    // console.log(p2, fs.existsSync(p2));

    // console.log(moduleDist);
    // console.log(packageDist);
    // console.log(viewerDir);

    // console.log(path.resolve(__dirname));
    // console.log(__dirname);

    (async () => {
        try {
            await kill(3056, 'tcp');
            await kill(8056, 'tcp');

            // console.log('packageDist2', packageDist2, process.argv);

            // process.env.NODE_ENV = 'production';

            // ============
            if (!process.argv) {
                process.argv = [];
            }

            for (let i = 0; i <= 3; i++) {
                if (typeof process.argv[i] === 'undefined') {
                    process.argv[i] = undefined;
                }
            }

            process.argv[2] = 'start';
            process.argv[3] = __dirname;

            console.log(path.resolve(__dirname)); // eslint-disable-line no-console
            console.log(path.resolve('./next.config.js')); // eslint-disable-line no-console
            console.log(fs.existsSync(path.resolve(__dirname, 'next.config.js'))); // eslint-disable-line no-console

            require('./src/main');
            require('next/dist/bin/next');

            // ==============
            // const nextStart = ()=>Promise.resolve(require('next/dist/cli/next-start').nextStart);
            // nextStart({ _: [1,2,3] }, 1, 2, 3).then((exec)=>exec({ _: ['start'] }, [packageDist])).then(() => {});

            // await nextStart([packageDist2]);

            // const { result } = concurrently([
            //     { command: `npx next start`, name: 'opexviewer' },
            //     // { command: `node ${mainFile1}`, name: 'opexbot' },
            // ], {
            //     prefix: 'name',
            //     killOthers: ['failure', 'success'],
            //     restartTries: 3,
            //     cwd: path.resolve(__dirname),
            // });

            // result.then((s) => {
            //     console.log('success');
            //     console.log(s);
            // }, f => {
            //     console.log('fail');
            //     console.log(f)
            // });

            const createWindow = () => {
                const win = new BrowserWindow({
                    title: 'Opexflow.com',
                    width: 1024,
                    height: 768,

                    // show: false,
                    icon: __dirname + '/icons/o.ico',

                    webPreferences: {
                        webviewTag: true,
                        nativeWindowOpen: true,
                        nodeIntegration: true,
                        enableRemoteModule: false,
                    },
                });

                win.removeMenu();
                win.setMenu(null);

                win.loadURL('http://localhost:3056/');

                // win.once('ready-to-show', () => {
                //     win.show();
                // });

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
