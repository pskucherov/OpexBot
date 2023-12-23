import fs from 'fs';
import path from 'path';

export class Log {
    logsDir = __dirname + '/../logs';
    logFile: string;
    logGroup: string;

    constructor(logGroup: string) {
        this.logGroup = logGroup;
        this.logFile = `${this.logsDir}/${this.logGroup}.txt`;
        this.check_dir(this.logFile);
    }

    refresh() {
        fs.writeFileSync(this.logFile, '', { flag: 'w' });
    }

    append(data: string) {
        fs.writeFileSync(this.logFile, data + '\n', { flag: 'a+' });
    }

    appendArray(data: string[]) {
        data.forEach(str => {
            if (str.length > 0) {
                this.append(str);
            }
        });
    }

    check_dir(file: string) {
        const dirName = path.dirname(file);

        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName, { recursive: true });
        }
    }
}
