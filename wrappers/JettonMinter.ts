import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, StateInit, Builder } from '@ton/core';

export type JettonMinterConfig = {
    adminAddress: Address;
    content: Cell;
    jettonWalletCode: Cell;
    bondedCurveAddress: Address;
};

export type ChangeContent = {
    $$type: 'ChangeContent';
    content: Cell;
};

export type Deploy = {
    $$type: 'Deploy';
    queryId: number;
};

export type Mint = {
    $$type: 'Mint';
    toAddress: Address;
    jettonAmount: bigint;
    amount: bigint;
    queryId: number;
};

export type CreateToken = {
    $$type: 'CreateToken';
    communityAdmin: Address;
    feeRecipient: Address;
    initialLiquidity: bigint;
    queryId: number;
};

export type JettonMinterMessage = Mint | Deploy | ChangeContent | CreateToken;

export function jettonMinterConfigToCell(config: JettonMinterConfig): Cell {
    return beginCell()
        .storeCoins(0) // total_supply
        .storeAddress(config.adminAddress)
        .storeRef(config.content)
        .storeRef(config.jettonWalletCode)
        .storeAddress(config.bondedCurveAddress)
        .endCell();
}

export function storeDeploy(src: Deploy) {
    return (builder: Builder) => {
        builder.storeUint(0, 32);
        builder.storeUint(src.queryId, 64);
    };
}

export function storeMint(src: Mint) {
    return (builder: Builder) => {
        builder.storeUint(21, 32);
        builder.storeUint(src.queryId, 64);
        builder.storeAddress(src.toAddress);
        builder.storeCoins(src.amount);
        builder.storeRef(
            beginCell()
                .storeUint(0x178d4519, 32)
                .storeUint(src.queryId, 64)
                .storeCoins(src.jettonAmount)
                .storeAddress(null)
                .storeAddress(src.toAddress)
                .storeCoins(0)
                .storeBit(false)
                .endCell()
        );
    };
}

export function storeChangeContent(src: ChangeContent) {
    return (builder: Builder) => {
        builder.storeUint(4, 32);
        builder.storeRef(src.content);
    };
}

export function storeCreateToken(src: CreateToken) {
    return (builder: Builder) => {
        builder.storeUint(1, 32); // op code for create_token
        builder.storeUint(src.queryId, 64);
        builder.storeAddress(src.communityAdmin);
        builder.storeAddress(src.feeRecipient);
        builder.storeCoins(src.initialLiquidity);
    };
}

export class JettonMinter implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new JettonMinter(address);
    }

    static createFromConfig(config: JettonMinterConfig, code: Cell, workchain = 0) {
        const data = jettonMinterConfigToCell(config);
        const init = { code, data };
        return new JettonMinter(contractAddress(workchain, init), init);
    }

    async send(
        provider: ContractProvider,
        via: Sender,
        args: { value: bigint; bounce?: boolean | null | undefined },
        message: JettonMinterMessage
    ) {
        let body: Cell;
        if (message.$$type === 'Deploy') {
            body = beginCell().store(storeDeploy(message)).endCell();
        } else if (message.$$type === 'Mint') {
            body = beginCell().store(storeMint(message)).endCell();
        } else if (message.$$type === 'ChangeContent') {
            body = beginCell().store(storeChangeContent(message)).endCell();
        } else if (message.$$type === 'CreateToken') {
            body = beginCell().store(storeCreateToken(message)).endCell();
        } else {
            throw new Error('Unsupported message type');
        }
        await provider.internal(via, {
            value: args.value,
            bounce: args.bounce,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: body,
        });
    }

    async sendMint(provider: ContractProvider, via: Sender, params: {
        toAddress: Address;
        jettonAmount: bigint;
        amount: bigint;
        queryId?: number;
        forwardPayload?: Cell;
    }) {
        await provider.internal(via, {
            value: params.amount,
            body: beginCell()
                .storeUint(21, 32) // op code for mint
                .storeUint(params.queryId ?? 0, 64)
                .storeAddress(params.toAddress)
                .storeCoins(params.jettonAmount)
                .storeRef(params.forwardPayload ?? beginCell().endCell())
                .endCell(),
        });
    }

    async sendCreateToken(provider: ContractProvider, via: Sender, params: {
        communityAdmin: Address;
        feeRecipient: Address;
        initialLiquidity: bigint;
        queryId?: number;
    }) {
        await provider.internal(via, {
            value: params.initialLiquidity + 50000000n, // Initial liquidity + 0.05 TON for gas
            body: beginCell()
                .storeUint(1, 32) // op code for create_token
                .storeUint(params.queryId ?? 0, 64)
                .storeAddress(params.communityAdmin)
                .storeAddress(params.feeRecipient)
                .storeCoins(params.initialLiquidity)
                .endCell(),
        });
    }

    async getJettonData(provider: ContractProvider) {
        const result = await provider.get('get_jetton_data', []);
        return {
            totalSupply: result.stack.readBigNumber(),
            mintable: result.stack.readBoolean(),
            adminAddress: result.stack.readAddress(),
            content: result.stack.readCell(),
            jettonWalletCode: result.stack.readCell(),
        };
    }

    async getWalletAddress(provider: ContractProvider, ownerAddress: Address) {
        const result = await provider.get('get_wallet_address', [
            { type: 'slice', cell: beginCell().storeAddress(ownerAddress).endCell() },
        ]);
        return result.stack.readAddress();
    }

    async getBondedCurveAddress(provider: ContractProvider) {
        const result = await provider.get('get_bonded_curve_address', []);
        return result.stack.readAddress();
    }
}