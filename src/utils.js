const path = require('path');
const fs = require('fs');

/**
 * @copypaste https://stackoverflow.com/questions/31645738/how-to-create-full-path-with-nodes-fs-mkdirsync
 *
 * @param {*} targetDir
 * @param {*} param1
 * @returns
 */
const mkDirByPathSync = (targetDir, { isRelativeToScript = false } = {}) => {
    const sep = path.sep;
    const initDir = path.isAbsolute(targetDir) ? sep : '';
    const baseDir = isRelativeToScript ? __dirname : '.';

    return targetDir.split(sep).reduce((parentDir, childDir) => {
        let curDir = baseDir;

        if (parentDir && childDir) {
            curDir = path.resolve(curDir, parentDir, childDir);
        } else if (parentDir) {
            curDir = path.resolve(curDir, parentDir);
        }

        try {
            fs.mkdirSync(curDir, { recursive: true });

            return curDir;
        } catch (err) {
            if (err.code === 'EEXIST') { // curDir already exists!
                return curDir;
            }

            // To avoid `EISDIR` error on Mac and `EACCES`-->`ENOENT` and `EPERM` on Windows.
            if (err.code === 'ENOENT') { // Throw the original parentDir error on curDir `ENOENT` failure.
                console.log(`EACCES: permission denied, mkdir '${parentDir}'`); // eslint-disable-line no-console
            }

            const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1;

            if (!caughtErr || caughtErr && curDir === path.resolve(targetDir)) {
                console.log(JSON.stringify(err)); // eslint-disable-line no-console
            }
        }

        return curDir;
    }, initDir);
};

const dateOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };

const logger = (a, b, c) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    return console.log(a || '', b || '', c || ''); // eslint-disable-line no-console
};

module.exports = {
    todayDate: new Date().toLocaleString('ru', dateOptions),
    mkDirByPathSync,
    logger,
};
