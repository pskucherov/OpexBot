import { InstrumentIdType, InstrumentStatus } from 'tinkoff-sdk-grpc-js/dist/generated/instruments';
import { Common } from './common';
import { InstrumentType } from 'tinkoff-sdk-grpc-js/dist/generated/common';

export class Instruments extends Common {
    async getAllShares() {
        try {
            return (await this.sdk.instruments.shares({
                instrumentStatus: InstrumentStatus.INSTRUMENT_STATUS_BASE,
            })).instruments;
        } catch (e) {
            return [];
        }
    }

    async getAllFutures() {
        try {
            return (await this.sdk.instruments.futures({
                instrumentStatus: InstrumentStatus.INSTRUMENT_STATUS_BASE,
            })).instruments;
        } catch (e) {
            return [];
        }
    }

    async getInstrumentById(id: string, idType?: InstrumentIdType) {
        return await this.sdk.instruments.getInstrumentBy({
            idType: idType || this.sdk.InstrumentIdType.INSTRUMENT_ID_TYPE_UID,
            id,
        });
    }

    async findInstrument(query: string) {
        return await this.sdk.instruments.findInstrument({
            query: query,
            instrumentKind: InstrumentType.INSTRUMENT_TYPE_SHARE,
        }).then(found => {
            return found.instruments
                .filter(instrument => instrument.first1minCandleDate && instrument.apiTradeAvailableFlag);
        });
    }
}
