import { createSdk } from 'tinkoff-sdk-grpc-js';
import { Account, GetAccountsResponse } from 'tinkoff-sdk-grpc-js/dist/generated/users';

export class Accounts {
    sdk: ReturnType<typeof createSdk>;

    constructor(sdk: ReturnType<typeof createSdk>) {
        this.sdk = sdk;
    }

    async create() {
        await this.sdk.sandbox.openSandboxAccount({});
    }

    async list(): Promise<GetAccountsResponse> {
        return await this.sdk.sandbox.getSandboxAccounts({});
    }

    async close(account: Account) {
        const { id } = account;
        await this.sdk.sandbox.closeSandboxAccount({ accountId: id });
    }

    async closeAll() {
        const { accounts } = await this.list();

        for (let i = 0; i < accounts?.length; i++) {
            await this.close(accounts[i]);
        }
    }

    async resetAllAccounts() {
        await this.closeAll();
        await this.create();
    }
}

