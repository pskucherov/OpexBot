import fs from "fs";
import path from "path";

export class Cache
{
    cacheDir = __dirname+'/../cache';
    cacheGroup: string;

    constructor(cacheGroup: string) {
        this.cacheGroup = cacheGroup;
    }

    get(key: string) {
        const cacheFile = `${this.cacheDir}/${this.cacheGroup}/${key}.txt`;
        if (fs.existsSync(cacheFile)) {
            const cacheContent = fs.readFileSync(cacheFile,  'utf-8');
            return JSON.parse(cacheContent);
        }
    }

    set(key: string, data: any) {
        const cacheFile = `${this.cacheDir}/${this.cacheGroup}/${key}.txt`;
        const cacheDirName = path.dirname(cacheFile);
        if (!fs.existsSync(cacheDirName)) {
            fs.mkdirSync(cacheDirName, { recursive: true });
        }
        fs.writeFileSync(cacheFile, JSON.stringify(data),{flag: 'a'});
    }
}