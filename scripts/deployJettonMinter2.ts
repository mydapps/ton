import { toNano, beginCell, Address } from '@ton/core';
import { JettonMinter } from '../wrappers/JettonMinter';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const jettonMinterCode = await compile('JettonMinter');
    const jettonWalletCode = await compile('JettonWallet');

    const metadata = {
        name: "Awesome TOken",
        symbol: "ABC",
        description: "This is an awesome TON Jetton token",
        decimals: "9",
        image: "https://dapps.social/logo.png"
    };

    const contentCell = beginCell();
    const metadataString = Object.entries(metadata)
        .map(([key, value]) => `${key}=${value}`)
        .join(',');
    contentCell.storeUint(0, 8).storeStringTail(metadataString);

    console.log('Deploying JettonMinter...');

    const jettonMinter = provider.open(
        JettonMinter.createFromConfig(
            {
                adminAddress: provider.sender().address!,
                content: contentCell.endCell(),
                jettonWalletCode: jettonWalletCode,
                metadata: {
                    name: metadata.name,
                    symbol: metadata.symbol,
                    description: metadata.description,
                    decimals: parseInt(metadata.decimals),
                    maxSupply: toNano('1000000000') // 1 billion tokens
                }
            },
            jettonMinterCode
        )
    );

    await jettonMinter.send(
        provider.sender(),
        {
            value: toNano('0.25'),
        },
        {
            $$type: 'Deploy',
            queryId: 0,
        }
    );

    await provider.waitForDeploy(jettonMinter.address);

    console.log('JettonMinter deployed at:', jettonMinter.address);

    // Note: Remove the immediate minting operation
    console.log('Deployment completed. Use a separate script to mint tokens.');
}