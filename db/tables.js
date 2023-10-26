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
    db.on('trace', data => {
        // console.log('trace', data);
    });

    await db.exec(`CREATE TABLE IF NOT EXISTS
        'statisticsParserState' (
            'accountId' STRING PRIMARY KEY NOT NULL,
            'openedDate' INTEGER,
            'closedDate' INTEGER,
            'lastParsedDateError' INTEGER DEFAULT 0,
            'lastParsedOperationsDateError' INTEGER DEFAULT 0,
            'operationsNextCursor' TEXT,
            'operationsNextCursorStart' INTEGER,
            'operationsNextCursorEnd' INTEGER,
            'reportParsed' BOOLEAN DEFAULT 0,
            'dividendParsed' BOOLEAN DEFAULT 0
        )
    `);

    //             'operationsFromStartParsed' BOOLEAN DEFAULT 0,
    // type: 0 - GetBrokerReport, 1 - GetDividendsForeignIssuer
    await db.exec(`CREATE TABLE IF NOT EXISTS 'statisticsParserTaskIds' (
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
        'checkNum' INTEGER DEFAULT 0,
        'parsed' BOOLEAN,
        'answer' TEXT
    )`);

    const dataReportRow = `
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
    `;

    await db.exec(`CREATE TABLE IF NOT EXISTS 'statisticsParsedDataReport' (${dataReportRow})`);

    // Для записи временных данных, пока отчёт не готов.
    await db.exec(`CREATE TABLE IF NOT EXISTS 'statisticsParsedDataReportBuffer' (${dataReportRow})`);

    await db.exec(`CREATE TABLE IF NOT EXISTS 'statisticsParsedDataDividend' (
        'accountId' TEXT,
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

    const operationRow = `
        'i' INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        'cursor' TEXT,
        'brokerAccountId' TEXT,
        'id' TEXT,
        'parentOperationId' TEXT,
        'name' TEXT,
        'date' INTEGER,
        'dateRound' INTEGER,
        'type' INTEGER,
        'description' TEXT,
        'state' INTEGER,
        'instrumentUid' TEXT,
        'figi' TEXT,
        'instrumentType' TEXT,
        'instrumentKind' TEXT,
        'payment' REAL,
        'paymentCurrency' TEXT,
        'paymentUnits' INTEGER,
        'paymentNano' INTEGER,
        'price' REAL,
        'priceCurrency' TEXT,
        'priceUnits' INTEGER,
        'priceNano' INTEGER,
        'commission' REAL,
        'commissionCurrency' TEXT,
        'commissionUnits' INTEGER,
        'commissionNano' INTEGER,
        'yield' REAL,
        'yieldCurrency' TEXT,
        'yieldUnits' INTEGER,
        'yieldNano' INTEGER,
        'yieldRelative' REAL,
        'yieldRelativeUnits' INTEGER,
        'yieldRelativeNano' INTEGER,
        'accruedInt' REAL,
        'accruedIntCurrency' TEXT,
        'accruedIntUnits' INTEGER,
        'accruedIntNano' INTEGER,
        'quantity' INTEGER,
        'quantityRest' INTEGER,
        'quantityDone' INTEGER,
        'cancelDateTime' INTEGER,
        'cancelReason' TEXT,
        'assetUid' TEXT
    `;

    await db.exec(`CREATE TABLE IF NOT EXISTS 'statisticsParsedDataOperations' (${operationRow})`);
    await db.exec(`CREATE TABLE IF NOT EXISTS 'statisticsParsedDataOperationsBuffer' (${operationRow})`);

    //
    await db.exec('CREATE INDEX IF NOT EXISTS \'accids\' ON "statisticsParserTaskIds" ("accountId" ASC, "startDate" ASC, "endDate" ASC)');
    await db.exec('CREATE INDEX IF NOT EXISTS \'taskId\' ON "statisticsParserTaskIds" ("taskId" ASC)');
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS 'scheduleUniq' ON
        "statisticsParserTaskIds" ("accountId", "startDate", "endDate", "type", "pageNum")
    `);

    // Операции, индекс по брокеру и времени
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS 'statisticsParsedDataOperationsUniq' ON
        "statisticsParsedDataOperations" ("brokerAccountId", "id", "parentOperationId")
    `);

    await db.exec(`CREATE INDEX IF NOT EXISTS 'statisticsParsedDataOperationsDate' ON
        "statisticsParsedDataOperationsBuffer" ("brokerAccountId", "dateRound")
    `);

    // Временные операции, индекс по брокеру и времени
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS 'statisticsParsedDataOperationsBufferUniq' ON
        "statisticsParsedDataOperationsBuffer" ("brokerAccountId", "id", "parentOperationId")
    `);
    await db.exec(`CREATE INDEX IF NOT EXISTS 'statisticsParsedDataOperationsBufferDate' ON
        "statisticsParsedDataOperationsBuffer" ("brokerAccountId", "dateRound")
    `);

    // Индекс по данным BrokerReport
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS 'statisticsParsedDataReportUniq' ON
        "statisticsParsedDataReport" ("accountId", "tradeId", "orderId")
    `);
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS 'statisticsParsedDataReportBufferUniq' ON
        "statisticsParsedDataReportBuffer" ("accountId", "tradeId", "orderId")
    `);
    await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS 'statisticsParsedDataDividendUniq' ON
        "statisticsParsedDataDividend" ("recordDate", "paymentDate", "isin")
    `);
};

class StatisticsTables {
    constructor(db) {
        this.db = db;
    }

    async startDownload(accountId, data) {
        try {
            await this.db.run(`INSERT INTO statisticsParserState
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
    async isStatisticsDownloadStarted(accountId) {
        try {
            return await this.db.get(
                'SELECT * FROM statisticsParserState WHERE accountId = ?',
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
            this.db.run(`UPDATE statisticsParserState 
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
    async startStatisticsParser(account) {
        if (!account || !account.id) {
            return;
        }

        try {
            await this.db.run(`INSERT INTO statisticsParserState (
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
                    "statisticsParserTaskIds" WHERE "accountId" = ? AND type = ?`,
                accountId,
                type,
            )) || {};
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    /**
     * Получает последнюю дату записи успешного парсинга.
     *
     * @param {String} accountId
     * @param {0|1} type - 0 - report, 1 - foreignDividend.
     * @returns
     */
    async getMaxRowDateSuccess(accountId, type) {
        try {
            return (await this.db.get(
                `SELECT MAX(endDate) as maxEndTime FROM
                        "statisticsParserTaskIds" WHERE "accountId" = ? AND type = ? AND answer NOTNULL`,
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
                    "statisticsParserTaskIds" (accountId, type, startDate, endDate)
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
                "statisticsParserTaskIds" WHERE "accountId" = ? AND type = ?`,
            accountId, type);

            const { withTaskId } = await this.db.get(`SELECT COUNT(*) as withTaskId FROM
                "statisticsParserTaskIds" WHERE "accountId" = ? AND type = ? AND taskId NOTNULL AND answer ISNULL`,
            accountId, type);

            const { withAnswer } = await this.db.get(`SELECT COUNT(*) as withAnswer FROM
                "statisticsParserTaskIds" WHERE "accountId" = ? AND type = ? AND answer NOTNULL`,
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
    async getNextTimeParse(accountId, isOperations = false) {
        try {
            const col = isOperations ? 'lastParsedOperationsDateError' : 'lastParsedDateError';

            const {
                lastParsedDateError,
                lastParsedOperationsDateError,
            } = (await this.db.get(`SELECT ${col} FROM
                "statisticsParserState" WHERE "accountId" = ?`,
            accountId)) || {
                lastParsedDateError: 0,
                lastParsedOperationsDateError: 0,
            };

            return Math.max((lastParsedDateError || lastParsedOperationsDateError || 0) + 85000, new Date().getTime());
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
    async saveErrorTime(accountId, isOperations = false) {
        try {
            const col = isOperations ? 'lastParsedOperationsDateError' : 'lastParsedDateError';

            return await this.db.run(
                `UPDATE "statisticsParserState" SET ${col} = ? WHERE "accountId" = ?`,
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
                    "statisticsParserTaskIds" WHERE "accountId" = ? AND taskId NOTNULL AND answer ISNULL 
                    ORDER BY lastCheck ASC, type ASC, id ASC LIMIT 1`,
            accountId,

                // (new Date().getTime()) - 120000 lastCheck < ? AND
            )) || {};

            if (data && data.id) {
                await this.db.run(
                    'UPDATE "statisticsParserTaskIds" SET lastCheck = (? + checkNum*5000), checkNum = checkNum + 1 WHERE "id" = ?',
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
                'UPDATE "statisticsParserTaskIds" SET taskId = ?, lastCheck = ? WHERE "id" = ?',
                taskId,
                new Date().getTime(),
                id,
            );
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    async insertTradeData(accountId, a, type = 0, isBuffer = false) {
        const table = isBuffer ? 'statisticsParsedDataReportBuffer' : 'statisticsParsedDataReport';

        try {
            if (!type) {
                await this.db.run(`INSERT INTO "${table}" (
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
                a.aciValue?.units,
                a.aciValue?.nano,
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
                await this.insertTradeData(accountId, a, type, false);
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }
        }

        try {
            return await this.db.run(`UPDATE "statisticsParserTaskIds" SET 
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
                "statisticsParserTaskIds" WHERE "accountId" = ? AND taskId ISNULL AND answer ISNULL 
                ORDER BY type ASC, id ASC LIMIT 1`,
            accountId,
            )) || {};
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    /**
     * Возвращает агрегированные доходы и расходы по операциям.
     *
     * @param {*} accountId
     * @returns
     */
    async getAggregatedCommission(accountId) {
        //  AND type NOT IN (15, 16, 22)
        try {
            return (await this.db.all(`
                SELECT
                    SUM("payment") as sumPayment, name, description, "paymentCurrency"
                FROM "statisticsParsedDataOperations"
                WHERE brokerAccountId = ?
                GROUP BY name, description, paymentCurrency`,
            accountId,
            )) || [];
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
            const cols = `accountId, tradeId, figi, tradeDatetime,
                exchange, direction, name, ticker, price, priceCurrency, orderAmountCurrency, quantity,
                brokerCommission, brokerCommissionCurrency,
                exchangeCommission, exchangeCommissionCurrency,
                exchangeClearingCommission, exchangeClearingCommissionCurrency`;
            let idsToStr = ids?.map(i => `'${i}'`).join(',') || '';

            const mainData = (await this.db.all(`SELECT 
                    ${cols}
                FROM
                    "statisticsParsedDataReport" WHERE "accountId" = ? AND tradeId NOT IN (${idsToStr})`,
            accountId,
            )) || [];

            mainData?.forEach(m => {
                if (idsToStr) {
                    idsToStr += `,'${m.tradeId}'`;
                } else {
                    idsToStr = `'${m.tradeId}'`;
                }
            });

            const bufData = (await this.db.all(`SELECT 
                    ${cols}
                FROM
                    "statisticsParsedDataReportBuffer" WHERE "accountId" = ? AND tradeId NOT IN (${idsToStr})`,
            accountId,
            )) || [];

            if (mainData?.length && bufData?.length) {
                return [].concat(mainData, bufData);
            } else if (mainData?.length) {
                return mainData;
            } else if (bufData?.length) {
                return bufData;
            }

            return [];
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    async clearAllOperations(accountId) {
        try {
            await this.db.all('DELETE FROM statisticsParserState WHERE accountId = ?', accountId);
            await this.db.all('DELETE FROM statisticsParserTaskIds WHERE accountId = ?', accountId);
            await this.db.all('DELETE FROM statisticsParsedDataReport WHERE accountId = ?', accountId);
            await this.db.all('DELETE FROM statisticsParsedDataReportBuffer WHERE accountId = ?', accountId);
            await this.db.all('DELETE FROM statisticsParsedDataDividend WHERE accountId = ?', accountId);
            await this.db.all('DELETE FROM statisticsParsedDataOperations WHERE brokerAccountId = ?', accountId);
            await this.db.all('DELETE FROM statisticsParsedDataOperationsBuffer WHERE brokerAccountId = ?', accountId);
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    async cleanBufferOperations(accountId) {
        try {
            await this.db.all('DELETE FROM statisticsParsedDataReportBuffer');
            await this.db.all('DELETE FROM statisticsParsedDataOperationsBuffer');
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    async operationsParserState(accountId) {
        try {
            const {
                operationsNextCursor,
                operationsNextCursorStart,
                operationsNextCursorEnd,
                openedDate,
                closedDate,
            } = await this.db.get(`SELECT
                operationsNextCursor, 
                operationsNextCursorStart,
                operationsNextCursorEnd,
                openedDate,
                closedDate    
            FROM
                "statisticsParserState" WHERE "accountId" = ?`,
            accountId) || {};

            let from;
            let to;

            if (operationsNextCursor) {
                from = operationsNextCursorStart;
                to = operationsNextCursorEnd;
            } else {
                if (operationsNextCursorEnd) {
                    from = operationsNextCursorEnd + 1;
                } else {
                    from = Math.max(operationsNextCursorStart || 0, openedDate);
                }

                to = closedDate ? closedDate : new Date().getTime();
            }

            if (from >= to) {
                return;
            }

            return {
                cursor: operationsNextCursor || '',
                from,
                to,
            };
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    /**
     * Сохраняет список операций и трейдов.
     *
     * @param {*} id
     * @param {*} taskId
     * @returns
     */
    async saveOperationsResponse(accountId, answer = [], isBuffer = false) { // eslint-disable-line
        const table = isBuffer ?
            'statisticsParsedDataOperationsBuffer' : 'statisticsParsedDataOperations';

        for (let i = 0; i < answer.length; i++) {
            const a = answer[i];

            try {
                const operationDate = new Date(a.date);

                operationDate.setUTCMilliseconds(0);

                // Сохраняем всё, кроме купли-продажи ценных бумаг.
                // Их сохраняем в трейды.
                if (isBuffer || ![15, 16, 22].includes(a.type)) {
                    await this.db.run(`INSERT INTO "${table}" (
                        'brokerAccountId',
                        'id',
                        'parentOperationId',
                        'name',
                        'date',
                        'dateRound',
                        'type',
                        'description',
                        'state',
                        'instrumentUid',
                        'figi',
                        'instrumentType',
                        'instrumentKind',
                        'payment',
                        'paymentCurrency',
                        'paymentUnits',
                        'paymentNano',
                        'price',
                        'priceCurrency',
                        'priceUnits',
                        'priceNano',
                        'commission',
                        'commissionCurrency',
                        'commissionUnits',
                        'commissionNano',
                        'yield',
                        'yieldCurrency',
                        'yieldUnits',
                        'yieldNano',
                        'yieldRelative',
                        'yieldRelativeUnits',
                        'yieldRelativeNano',
                        'accruedInt',
                        'accruedIntCurrency',
                        'accruedIntUnits',
                        'accruedIntNano',
                        'quantity',
                        'quantityRest',
                        'quantityDone',
                        'cancelDateTime',
                        'cancelReason',
                        'assetUid'
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                    )`,

                    a.brokerAccountId,
                    a.id,
                    a.parentOperationId,
                    a.name,
                    a.date,
                    operationDate.getTime(),
                    a.type,
                    a.description,
                    a.state,
                    a.instrumentUid,
                    a.figi,
                    a.instrumentType,
                    a.instrumentKind,
                    getPrice(a?.payment),
                    a?.payment.currency,
                    a?.payment.units,
                    a?.payment.nano,
                    getPrice(a?.price),
                    a?.price.currency,
                    a?.price.units,
                    a?.price.nano,
                    getPrice(a?.commission),
                    a?.commission?.currency,
                    a?.commission?.units,
                    a?.commission?.nano,
                    getPrice(a?.yield),
                    a.yield?.currency,
                    a.yield?.units,
                    a.yield?.nano,
                    getPrice(a?.yieldRelative),
                    a.yieldRelative?.units,
                    a.yieldRelative?.nano,
                    getPrice(a?.accruedInt),
                    a.accruedInt?.currency,
                    a.accruedInt?.units,
                    a.accruedInt?.nano,
                    a.quantity,
                    a.quantityRest,
                    a.quantityDone,
                    a.cancelDateTime ? new Date(a.cancelDateTime).getTime() : 0,
                    a.cancelReason,
                    a.assetUid,
                    );
                }
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }

            try {
                if (a?.tradesInfo?.trades?.length) {
                    for (let j = 0; j < a.tradesInfo.trades.length; j++) {
                        try { // eslint-disable-line
                            const t = a.tradesInfo.trades[j];

                            const roundedDate = new Date(t.date);

                            roundedDate.setUTCMilliseconds(0);

                            await this.insertTradeData(accountId, {
                                ...a,
                                ...t,
                                accountId: a.brokerAccountId,

                                tradeId: t.num,
                                orderId: a.id,

                                tradeDatetime: roundedDate.getTime(),
                                direction: [15, 16].includes(a.type) ? 'Покупка' : 'Продажа',

                                // figi: a.figi,
                                // name: t.name,
                                // quantity: t.quantity,
                                // price: t.price,
                                // yield: t.yield,
                            }, 0, true);
                        } catch (e) {
                            console.log(e); // eslint-disable-line no-console
                        }
                    }
                }

                await this.syncOperationsCommissionMain(accountId);
            } catch (e) {
                console.log(e); // eslint-disable-line no-console
            }
        }
    }

    /**
     * Собирает комиссию с дочерних операций и сохраняет во временные трейды, для подсчёта комиссии.
     *
     * @param {String} accountId
     */
    async syncOperationsCommissionMain(accountId) {
        try {
            const tradesWithoutCommission = (await this.db.all(`SELECT 
                    id, parentOperationId, payment, paymentCurrency, paymentUnits, paymentNano
                FROM
                    "statisticsParsedDataOperations" 
                WHERE 
                    brokerAccountId = ? AND
                    parentOperationId IN (
                        SELECT orderId FROM "statisticsParsedDataReportBuffer" WHERE "brokerCommission" ISNULL
                    )
                `,
            accountId,
            )) || [];

            if (tradesWithoutCommission?.length) {
                const opToSave = {};
                const keys = [];

                for (let i = 0; i < tradesWithoutCommission.length; i++) {
                    const t = tradesWithoutCommission[i];

                    if (!opToSave[t.parentOperationId]) {
                        keys.push(t.parentOperationId);

                        opToSave[t.parentOperationId] = {
                            payment: t.payment,
                            paymentCurrency: t.paymentCurrency,
                            paymentUnits: t.paymentUnits,
                            paymentNano: t.paymentNano,
                        };
                    } else {
                        opToSave[t.parentOperationId].payment += t.payment;
                        opToSave[t.parentOperationId].paymentCurrency += t.paymentCurrency;
                        opToSave[t.parentOperationId].paymentUnits += t.paymentUnits;
                        opToSave[t.parentOperationId].paymentNano += t.paymentNano;
                    }
                }

                for (let i = 0; i < keys.length; i++) {
                    await this.db.run(
                        `UPDATE "statisticsParsedDataReportBuffer" SET 
                            brokerCommission = ?,
                            brokerCommissionCurrency = ?,
                            brokerCommissionUnits = ?,
                            brokerCommissionNano = ?
                        WHERE "orderId" = ?`,
                        opToSave[keys[i]].payment,
                        opToSave[keys[i]].paymentCurrency,
                        opToSave[keys[i]].paymentUnits,
                        opToSave[keys[i]].paymentNano,
                        keys[i],
                    );
                }
            }
        } catch (e) {
            console.log(e); // eslint-disable-line
        }
    }

    /**
     * Сохраняет даты последнейго парсера и курсоры.
     *
     * @param {String} accountId
     * @returns
     */
    async saveOperationsCursor(accountId, cursor = '', from = 0, to = 0) {
        try {
            return await this.db.run(
                `UPDATE "statisticsParserState" SET 
                    operationsNextCursor = ?, 
                    operationsNextCursorStart = ?,
                    operationsNextCursorEnd = ?             
                WHERE "accountId" = ?`,
                cursor,
                from,
                to,
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
    StatisticsTables,
};
