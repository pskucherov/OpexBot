const path = require('path');

const getDBPath = () => {
    return path.resolve(
        path.join(__dirname, '..', 'db', 'data').replace(path.sep + 'app.asar', ''),
    );
};

const createTables = async db => {
    // Таблица счетов. Используется в качестве кеша для работы с историей.
    // await db.exec(`CREATE TABLE IF NOT EXISTS
    //     'accounts' (
    //         'id' INTEGER PRIMARY KEY NOT NULL,
    //         'name' TEXT,
    //         'openedDate' INTEGER,
    //         'closedDate' INTEGER,
    //         'accessLevel' INTEGER
    //     )
    // `);

    await db.exec(`CREATE TABLE IF NOT EXISTS
        'analyticsParserState' (
            'accountId' STRING PRIMARY KEY NOT NULL,
            'openedDate' INTEGER,
            'closedDate' INTEGER,
            'lastParsedDateError' INTEGER DEFAULT 0,
            'reportParsed' BOOLEAN DEFAULT 0,
            'dividendParsed' BOOLEAN DEFAULT 0
        )
    `);

    // type: 0 - GetBrokerReport, 1 - GetDividendsForeignIssuer
    await db.exec(`CREATE TABLE IF NOT EXISTS 'analyticsParserTaskIds' (
        'id' INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        'taskId' TEXT,
        'type' INTEGER DEFAULT 0,
        'accountId' TEXT,
        'startDate' INTEGER,
        'endDate' INTEGER,
        'pagesCount' INTEGER DEFAULT 1,
        'pageNum' INTEGER DEFAULT 0,
        'lastCheck' INTEGER,
        'parsed' BOOLEAN,
        'answer' TEXT
    )`);

    await db.exec('CREATE INDEX IF NOT EXISTS \'accids\' ON "analyticsParserTaskIds" ("accountId" ASC, "startDate" ASC, "endDate" ASC)');
    await db.exec('CREATE INDEX IF NOT EXISTS \'taskId\' ON "analyticsParserTaskIds" ("taskId" ASC)');
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS 'scheduleUniq' ON
        "analyticsParserTaskIds" ("accountId", "startDate", "endDate", "type", "pageNum")
    `);
};

class AnalyticsTables {
    constructor(db) {
        this.db = db;
    }

    async startDownload(accountId, data) {
        try {
            await this.db.run(`INSERT INTO analyticsParserState
            ("accountId","openedDate","closedDate") VALUES
            (:accountId, :openedDate, :closedDate)
        `, {
                ':accountId': accountId,
                ':openedDate': data.openedDate,
                ':closedDate': data.closedDate || 0,
            });
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    /**
     * Получает состояние загрузки истории. Если есть запись, значит загрузка начата.
     *
     * @param {*} accountId
     */
    async isAnalyticsDownloadStarted(accountId) {
        try {
            return await this.db.get(
                'SELECT * FROM analyticsParserState WHERE accountId = ?',
                accountId,
            );
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    /**
     * Обновляет дату закрытия аккаунта, если он был закрыт.
     *
     * @param {*} accountId
     * @param {*} closeDate
     */
    async setAccountCloseDate(accountId, closeDate) {
        try {
            this.db.run(`UPDATE analyticsParserState 
                SET closedDate = ? WHERE accountId = ?`,
            closeDate,
            accountId,
            );
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    /**
     * Создаёт запись о том, что нужно начать скачивание истории.
     *
     * @param {*} account
     * @returns
     */
    async startAnalyticsParser(account) {
        if (!account || !account.id) {
            return;
        }

        try {
            await this.db.run(`INSERT INTO analyticsParserState (
                accountId, openedDate, closedDate
            ) VALUES (?, ?, ?)`,
            account.id,
            new Date(account.openedDate).getTime() || 0,
            new Date(account.closedDate).getTime() || 0,
            );
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    /**
     * Получает последнюю дату записи парсинга.
     *
     * @param {String} accountId
     * @param {0|1} type - 0 - report, 1 - foreignDividend.
     * @returns
     */
    async getMaxRowDate(accountId, type) {
        try {
            return await this.db.get(
                `SELECT MAX(endDate) as maxEndTime FROM
                    "analyticsParserTaskIds" WHERE "accountId" = ? AND type = ?`,
                accountId,
                type,
            );
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    /**
     * Добавляет строку для
     * @param {*} accountId
     * @param {*} type
     * @param {*} startDate
     * @param {*} endDate
     * @returns
     */
    async insertParseInterval(accountId, type, startDate, endDate) {
        try {
            return await this.db.run(
                `INSERT INTO
                    "analyticsParserTaskIds" (accountId, type, startDate, endDate)
                VALUES (?, ?, ?, ?)`,
                accountId,
                type,
                startDate,
                endDate,
            );
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    async downloadState(accountId, type) {
        try {
            const { allCount } = await this.db.get(`SELECT COUNT(*) as allCount FROM
                "analyticsParserTaskIds" WHERE "accountId" = ? AND type = ?`,
            accountId, type);

            const { withTaskId } = await this.db.get(`SELECT COUNT(*) as withTaskId FROM
                "analyticsParserTaskIds" WHERE "accountId" = ? AND type = ? AND taskId NOTNULL AND answer ISNULL`,
            accountId, type);

            const { withAnswer } = await this.db.get(`SELECT COUNT(*) as withAnswer FROM
                "analyticsParserTaskIds" WHERE "accountId" = ? AND type = ? AND answer NOTNULL`,
            accountId, type);

            return {
                allCount,
                withTaskId,
                withAnswer,
            };
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }
}

module.exports = {
    getDBPath,
    createTables,
    AnalyticsTables,
};
