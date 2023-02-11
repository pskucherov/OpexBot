const path = require('path');

const getDBPath = () => {
    return path.resolve(
        path.join(__dirname, '..', 'db', 'data').replace(path.sep + 'app.asar', ''),
    );
};

const getPrice = quotation => {
    if (!quotation || typeof quotation !== 'object') {
        return quotation;
    }

    if (quotation.nano) {
        return quotation.units + quotation.nano / 1e9;
    }

    return quotation.units;
};

const createTables = async db => {
    // db.on('trace', (data) => {
    //     console.log('trace', data);
    // })

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
        'itemsCount' INTEGER,
        'lastCheck' INTEGER,
        'parsed' BOOLEAN,
        'answer' TEXT
    )`);

    await db.exec(`CREATE TABLE IF NOT EXISTS 'analyticsParsedDataReport' (
        'accountId' TEXT,
        'tradeId' TEXT,
        'orderId' TEXT,
        'figi' TEXT,
        'executeSign' TEXT,
        'tradeDatetime' INTEGER,
        'exchange' TEXT,
        'classCode' TEXT,
        'direction' TEXT,
        'name' TEXT,
        'ticker' TEXT,
        'price' REAL,
        'priceUnits' INTEGER,
        'priceNano' INTEGER,
        'priceCurrency' TEXT,
        'quantity' INTEGER,
        'orderAmount' REAL,
        'orderAmountCurrency' TEXT,
        'orderAmountUnits' INTEGER,
        'orderAmountNano' INTEGER,
        'aciValue' REAL,
        'aciValueUnits' INTEGER,
        'aciValueNano' INTEGER,
        'totalOrderAmount' REAL,
        'totalOrderAmountCurrency' TEXT,
        'totalOrderUnits' INTEGER,
        'totalOrderNano' INTEGER,
        'brokerCommission' REAL,
        'brokerCommissionCurrency' TEXT,
        'brokerCommissionUnits' INTEGER,
        'brokerCommissionNano' INTEGER,
        'exchangeCommission' REAL,
        'exchangeCommissionCurrency' TEXT,
        'exchangeCommissionUnits' INTEGER,
        'exchangeCommissionNano' INTEGER,
        'exchangeClearingCommission' REAL,
        'exchangeClearingCommissionCurrency' TEXT,
        'exchangeClearingCommissionUnits' INTEGER,
        'exchangeClearingCommissionNano' INTEGER,
        'repoRate' REAL,
        'repoRateUnits' INTEGER,
        'repoRateNano' INTEGER,
        'party' TEXT,
        'clearValueDate' INTEGER,
        'secValueDate' INTEGER,
        'brokerStatus' TEXT,
        'separateAgreementType' TEXT,
        'separateAgreementNumber' TEXT,
        'separateAgreementDate' TEXT,
        'deliveryType' TEXT
    )`);

    await db.exec(`CREATE TABLE IF NOT EXISTS 'analyticsParsedDataDividend' (
        'recordDate' INTEGER,
        'paymentDate' INTEGER,
        'securityName' TEXT,
        'isin' TEXT,
        'issuerCountry' TEXT,
        'quantity' INTEGER,
        'dividend' REAL,
        'dividendUnits' INTEGER,
        'dividendNano' INTEGER,
        'externalCommission' REAL,
        'externalCommissionUnits' INTEGER,
        'externalCommissionNano' INTEGER,
        'dividendGross' REAL,
        'dividendGrossUnits' INTEGER,
        'dividendGrossNano' INTEGER,
        'tax' REAL,
        'taxUnits' INTEGER,
        'taxNano' INTEGER,
        'dividendAmount' REAL,
        'dividendAmountUnits' INTEGER,
        'dividendAmountNano' INTEGER,
        'currency' TEXT
    )`);

    await db.exec('CREATE INDEX IF NOT EXISTS \'accids\' ON "analyticsParserTaskIds" ("accountId" ASC, "startDate" ASC, "endDate" ASC)');
    await db.exec('CREATE INDEX IF NOT EXISTS \'taskId\' ON "analyticsParserTaskIds" ("taskId" ASC)');
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS 'scheduleUniq' ON
        "analyticsParserTaskIds" ("accountId", "startDate", "endDate", "type", "pageNum")
    `);

    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS 'analyticsParsedDataReportUniq' ON
        "analyticsParsedDataReport" ("accountId", "tradeId", "orderId")
    `);
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS 'analyticsParsedDataDividendUniq' ON
        "analyticsParsedDataDividend" ("recordDate", "paymentDate", "isin")
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
            return (await this.db.get(
                `SELECT MAX(endDate) as maxEndTime FROM
                    "analyticsParserTaskIds" WHERE "accountId" = ? AND type = ?`,
                accountId,
                type,
            )) || {};
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

    /**
     * Возвращает время после которого можно делать запрос.
     *
     * @param {String} accountId
     * @returns
     */
    async getNextTimeParse(accountId) {
        try {
            const { lastParsedDateError } = (await this.db.get(`SELECT lastParsedDateError FROM
                "analyticsParserState" WHERE "accountId" = ?`,
            accountId)) || { lastParsedDateError: 0 };

            return Math.max(lastParsedDateError + 85000, new Date().getTime());
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    /**
     * Сохраняет время последней ошибки, чтобы сделать таймаут на минуту.
     *
     * @param {String} accountId
     * @returns
     */
    async saveErrorTime(accountId) {
        try {
            return await this.db.run(
                'UPDATE "analyticsParserState" SET lastParsedDateError = ? WHERE "accountId" = ?',
                new Date().getTime(),
                accountId,
            );
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    /**
     * Получает запрос, для которого отчёт уже должен был быть сформирован.
     *
     * @param {String} accountId
     * @returns
     */
    async getParamsForGetData(accountId) {
        try {
            const data = (await this.db.get(`SELECT id, taskId, type, startDate, endDate, pageNum  FROM
                    "analyticsParserTaskIds" WHERE "accountId" = ? AND taskId NOTNULL AND answer ISNULL 
                    ORDER BY lastCheck ASC, type ASC, id ASC LIMIT 1`,
            accountId,

                // (new Date().getTime()) - 120000 lastCheck < ? AND
            )) || {};

            if (data && data.id) {
                await this.db.run(
                    'UPDATE "analyticsParserTaskIds" SET lastCheck = ? WHERE "id" = ?',
                    new Date().getTime(),
                    data.id,
                );
            }

            return data;
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    /**
     * Сохраняет taskId для дальнейшего парсинга.
     *
     * @param {*} id
     * @param {*} taskId
     * @returns
     */
    async saveTaskId(id, taskId) {
        try {
            return await this.db.run(
                'UPDATE "analyticsParserTaskIds" SET taskId = ?, lastCheck = ? WHERE "id" = ?',
                taskId,
                new Date().getTime(),
                id,
            );
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    /**
     * Сохраняет ответ с отчётом (или с его отсутствием).
     *
     * @param {*} id
     * @param {*} taskId
     * @returns
     */
    async saveResponse(id, type, data) {
        const {
            accountId,
            pagesCount,
            pageNum,
            itemsCount,
            answer,
        } = data;

        for (let i = 0; i < answer.length; i++) {
            const a = answer[i];

            try {
                if (!type) {
                    await this.db.run(`INSERT INTO "analyticsParsedDataReport" (
                        "accountId",
                        "tradeId",
                        "orderId",
                        "figi",
                        "executeSign",
                        "tradeDatetime",
                        "exchange",
                        "classCode",
                        "direction",
                        "name",
                        "ticker",
                        "price",
                        "priceUnits",
                        "priceNano",
                        "priceCurrency",
                        "quantity",
                        "orderAmount",
                        "orderAmountCurrency",
                        "orderAmountUnits",
                        "orderAmountNano",
                        "aciValue",
                        "aciValueUnits",
                        "aciValueNano",
                        "totalOrderAmount",
                        "totalOrderAmountCurrency",
                        "totalOrderUnits",
                        "totalOrderNano",
                        "brokerCommission",
                        "brokerCommissionCurrency",
                        "brokerCommissionUnits",
                        "brokerCommissionNano",
                        "exchangeCommission",
                        "exchangeCommissionCurrency",
                        "exchangeCommissionUnits",
                        "exchangeCommissionNano",
                        "exchangeClearingCommission",
                        "exchangeClearingCommissionCurrency",
                        "exchangeClearingCommissionUnits",
                        "exchangeClearingCommissionNano",
                        "repoRate",
                        "repoRateUnits",
                        "repoRateNano",
                        "party",
                        "clearValueDate",
                        "secValueDate",
                        "brokerStatus",
                        "separateAgreementType",
                        "separateAgreementNumber",
                        "separateAgreementDate",
                        "deliveryType"
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? 
                    )`,
                    accountId,
                    a.tradeId,
                    a.orderId,
                    a.figi,
                    a.executeSign,
                    a.tradeDatetime,
                    a.exchange,
                    a.classCode,
                    a.direction,
                    a.name,
                    a.ticker,
                    getPrice(a.price),
                    a.price?.units,
                    a.price?.nano,
                    a.price?.currency,
                    a.quantity,
                    getPrice(a.orderAmount),
                    a.orderAmount?.currency,
                    a.orderAmount?.units,
                    a.orderAmount?.nano,
                    getPrice(a.aciValue),
                    a.aciValue.units,
                    a.aciValue.nano,
                    getPrice(a.totalOrderAmount),
                    a.totalOrderAmount?.currency,
                    a.totalOrderAmount?.units,
                    a.totalOrderAmount?.nano,
                    getPrice(a.brokerCommission),
                    a.brokerCommission?.currency,
                    a.brokerCommission?.units,
                    a.brokerCommission?.nano,
                    getPrice(a.exchangeCommission),
                    a.exchangeCommission?.currency,
                    a.exchangeCommission?.units,
                    a.exchangeCommission?.nano,
                    getPrice(a.exchangeClearingCommission),
                    a.exchangeClearingCommission?.currency,
                    a.exchangeClearingCommission?.units,
                    a.exchangeClearingCommission?.nano,
                    getPrice(a.repoRate),
                    a.repoRate?.units,
                    a.repoRate?.nano,
                    a.party,
                    a.clearValueDate,
                    a.secValueDate,
                    a.brokerStatus,
                    a.separateAgreementType,
                    a.separateAgreementNumber,
                    a.separateAgreementDate,
                    a.deliveryType,
                    );
                }
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }
        }

        try {
            return await this.db.run(`UPDATE "analyticsParserTaskIds" SET 
                    pagesCount = ?,
                    pageNum = ?,
                    itemsCount = ?,
                    lastCheck = ?,
                    parsed = ?,
                    answer = ?
                    WHERE "id" = ?`,
            Number(pagesCount),
            Number(pageNum),
            Number(itemsCount),
            new Date().getTime(),
            !type ? (Number(pageNum) + 1) === Number(pagesCount) :
                Number(pageNum) === Number(pagesCount),
            JSON.stringify(answer),
            id,
            );
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    /**
     * Получает тип запроса и время для него,
     * для которого ещё не было запроса на формирование отчёта.
     *
     * @param {String} accountId
     * @returns
     */
    async getTimeAndTypeForRequest(accountId) {
        try {
            return (await this.db.get(`SELECT id, type, startDate, endDate FROM
                "analyticsParserTaskIds" WHERE "accountId" = ? AND taskId ISNULL AND answer ISNULL 
                ORDER BY type ASC, id ASC LIMIT 1`,
            accountId,
            )) || {};
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    /**
     * Получает сделки, за исключением массива который уже был передан.
     *
     * @param {String} accountId
     * @param {String[]} ids
     * @returns
     */
    async getTrades(accountId, ids) {
        try {
            const idsToStr = ids.map(i => `'${i}'`).join(', ');

            return (await this.db.all(`SELECT 
                    accountId, tradeId, figi, tradeDatetime,
                    exchange, direction, name, ticker, price, priceCurrency, quantity,
                    brokerCommission, brokerCommissionCurrency,
                    exchangeCommission, exchangeCommissionCurrency,
                    exchangeClearingCommission, exchangeClearingCommissionCurrency
                FROM
                    "analyticsParsedDataReport" WHERE "accountId" = ? AND tradeId NOT IN (${idsToStr})`,
            accountId,
            )) || {};
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
