// @ts-nocheck
/* eslint @typescript-eslint/no-explicit-any: 0 */
/* eslint @typescript-eslint/no-unused-vars: 0 */
/* eslint @typescript-eslint/ban-types: 0 */
/* eslint max-len: 0 */
/* eslint sonarjs/no-duplicate-string: 0 */
const path = require('path');

const getDBPath = () => {
    return path.resolve(
        path.join(__dirname, '..', 'db', 'data').replace(path.sep + 'app.asar', ''),
    );
};

const createTables = async db => {
    db.on('trace', _data => {
        // console.log('trace', data);
    });

    await db.exec(`CREATE TABLE IF NOT EXISTS
        'exampleTable' (
            'accountId' STRING PRIMARY KEY NOT NULL,
            'openedDate' INTEGER,
            'closedDate' INTEGER
        )
    `);
};

class DemoTables {
    constructor(db) {
        this.db = db;
    }

    async insertData(accountId, data) {
        try {
            await this.db.run(`INSERT INTO exampleTable
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
    async selectData(accountId) {
        try {
            return await this.db.get(
                'SELECT * FROM exampleTable WHERE accountId = ?',
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
    async updateData(accountId, closeDate) {
        try {
            this.db.run(`UPDATE exampleTable 
                SET closedDate = ? WHERE accountId = ?`,
            closeDate,
            accountId,
            );
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }
}

module.exports = {
    getDBPath,
    createTables,
    DemoTables,
};
