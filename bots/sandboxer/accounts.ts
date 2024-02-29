import { createSdk } from 'tinkoff-sdk-grpc-js';
import { MoneyValue } from 'tinkoff-sdk-grpc-js/dist/generated/common';
import { OpenSandboxAccountResponse } from 'tinkoff-sdk-grpc-js/dist/generated/sandbox';
import { Account, GetAccountsResponse } from 'tinkoff-sdk-grpc-js/dist/generated/users';

export class Accounts {
    sdk: ReturnType<typeof createSdk>;

    constructor(sdk: ReturnType<typeof createSdk>) {
        this.sdk = sdk;
    }

    async create(): Promise<OpenSandboxAccountResponse> {
        return await this.sdk.sandbox.openSandboxAccount({});
    }

    async payIn(props: {
        accountId: string,
        amount: MoneyValue,
    }) {
        return await this.sdk.sandbox.sandboxPayIn(props);
    }

    async list(): Promise<GetAccountsResponse> {
        return await this.sdk.sandbox.getSandboxAccounts({});
    }

    async getPortfolio({ accountId }: { accountId: string }) {
        return await this.sdk.sandbox.getSandboxPortfolio({
            accountId,
        });
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
