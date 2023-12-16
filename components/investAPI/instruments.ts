import { InstrumentIdType } from "tinkoff-sdk-grpc-js/dist/generated/instruments";
import { Common } from "./common";

export class Instruments extends Common {
    async getInstrumentById(id: string, idType?: InstrumentIdType) {
        return await this.sdk.instruments.getInstrumentBy({
            idType: idType || this.sdk.InstrumentIdType.INSTRUMENT_ID_TYPE_UID,
            id,
        });
    }
}
