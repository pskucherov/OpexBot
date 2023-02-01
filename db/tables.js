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
        'historyParserState' (
            'accountId' STRING PRIMARY KEY NOT NULL, 
            'openedDate' INTEGER, 
            'closedDate' INTEGER,
            'lastParsedDate' INTEGER DEFAULT 0
        )
    `);
};

class HistoryTables {
    constructor(db) {
        this.db = db;
    }

    async startDownload(accountId, data) {
        try {
            await this.db.run(`INSERT INTO historyParserState
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
    async isHistoryDownloadStarted(accountId) {
        try {
            return await this.db.get(
                'SELECT * FROM historyParserState WHERE accountId = ?',
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
            this.db.run('UPDATE historyParserState SET closedDate = ? WHERE accountId = ?',
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
    async startHistoryParser(account) {
        if (!account || !account.id) {
            return;
        }

        try {
            await this.db.run('INSERT INTO historyParserState (accountId, openedDate, closedDate) VALUES (?, ?, ?)',
                account.id,
                new Date(account.openedDate).getTime() || 0,
                new Date(account.closedDate).getTime() || 0,
            );
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }
}

module.exports = {
    getDBPath,
    createTables,
    HistoryTables,
};
