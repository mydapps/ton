import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type BondedCurveConfig = {
    adminAddress: Address;
    jettonMinter: Address;
};

export function bondedCurveConfigToCell(config: BondedCurveConfig): Cell {
    return beginCell()
        .storeAddress(config.adminAddress)
        .storeAddress(config.jettonMinter)
        .storeDict(null) // Initialize with an empty dictionary for tokens
        .endCell();
}

export class BondedCurve implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new BondedCurve(address);
    }

    static createFromConfig(config: BondedCurveConfig, code: Cell, workchain = 0) {
        const data = bondedCurveConfigToCell(config);
        const init = { code, data };
        return new BondedCurve(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async getAdminAddress(provider: ContractProvider) {
        const result = await provider.get('get_admin_address', []);
        return result.stack.readAddress();
    }

    async getJettonMinter(provider: ContractProvider) {
        const result = await provider.get('get_jetton_minter', []);
        return result.stack.readAddress();
    }

    async getCurveData(provider: ContractProvider) {
        const result = await provider.get('get_curve_data', []);
        return {
            curveSupply: result.stack.readBigNumber(),
            curveBalance: result.stack.readBigNumber(),
        };
    }
    
    async getTokenData(provider: ContractProvider, tokenAddress: Address) {
        const result = await provider.get('get_token_data', [
            { type: 'slice', cell: beginCell().storeAddress(tokenAddress).endCell() },
        ]);
        return {
            totalSupply: result.stack.readBigNumber(),
            liquidity: result.stack.readBigNumber(),
            communityAdmin: result.stack.readAddress(),
            feeRecipient: result.stack.readAddress(),
            jettonWalletAddress: result.stack.readAddress(),
        };
    }

    async getContractData(provider: ContractProvider) {
        const result = await provider.get('get_contract_data', []);
        return result.stack.readCell();
    }

    async sendBuyTokens(provider: ContractProvider, via: Sender, params: {
        tokenAddress: Address;
        amount: bigint;
        queryId?: number;
    }) {
        await provider.internal(via, {
            value: params.amount + 50000000n, // Amount to buy + 0.05 TON for gas
            body: beginCell()
                .storeUint(3, 32) // op code for buy_tokens
                .storeUint(params.queryId ?? 0, 64)
                .storeAddress(params.tokenAddress)
                .endCell(),
        });
    }

    async sendSellTokens(provider: ContractProvider, via: Sender, params: {
        tokenAddress: Address;
        amount: bigint;
        queryId?: number;
    }) {
        await provider.internal(via, {
            value: 50000000n, // 0.05 TON for gas
            body: beginCell()
                .storeUint(4, 32) // op code for sell_tokens
                .storeUint(params.queryId ?? 0, 64)
                .storeAddress(params.tokenAddress)
                .storeCoins(params.amount)
                .endCell(),
        });
    }
}