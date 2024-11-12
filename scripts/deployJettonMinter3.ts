import { toNano, beginCell, Address, Dictionary, Cell } from '@ton/core';
import { JettonMinter } from '../wrappers/JettonMinter';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const jettonMinterCode = await compile('JettonMinter');
    const jettonWalletCode = await compile('JettonWallet');

    console.log('Deploying JettonMinter...');

    const metadata = Dictionary.empty(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
    metadata.set(Buffer.from('name'.padEnd(32, '\0')), beginCell().storeUint(0, 8).storeBuffer(Buffer.from('Awesome Token')).endCell());
    metadata.set(Buffer.from('symbol'.padEnd(32, '\0')), beginCell().storeUint(0, 8).storeBuffer(Buffer.from('AWS')).endCell());
    metadata.set(Buffer.from('description'.padEnd(32, '\0')), beginCell().storeUint(0, 8).storeBuffer(Buffer.from('This is an awesome TON Jetton token')).endCell());
    metadata.set(Buffer.from('decimals'.padEnd(32, '\0')), beginCell().storeUint(0, 8).storeBuffer(Buffer.from('9')).endCell());
    metadata.set(Buffer.from('image'.padEnd(32, '\0')), beginCell().storeUint(0, 8).storeBuffer(Buffer.from('https://dapps.social/logo.png')).endCell());

    const contentCell = beginCell().storeUint(0, 8).storeDict(metadata).endCell();

    const jettonMinter = provider.open(
        JettonMinter.createFromConfig(
            {
                adminAddress: provider.sender().address!,
                content: contentCell,
                jettonWalletCode: jettonWalletCode,
                metadata: {
                    name: "Awesome Token",
                    symbol: "AWS",
                    description: "This is an awesome TON Jetton token",
                    decimals: 9,
                    maxSupply: toNano('1000000000') // 1 billion tokens
                }
            },
            jettonMinterCode
        )
    );

    console.log('Sending deployment transaction...');
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

    console.log('Waiting for deployment...');
    await provider.waitForDeploy(jettonMinter.address);

    console.log('JettonMinter deployed at:', jettonMinter.address);

    console.log('Fetching Jetton data...');
    const jettonData = await jettonMinter.getJettonData();
    console.log('Jetton Data:');
    console.log('- Total Supply:', jettonData.totalSupply);
    console.log('- Mintable:', jettonData.mintable);
    console.log('- Admin Address:', jettonData.adminAddress);
    console.log('- Content:', jettonData.content);

    console.log('Fetching wallet address for the deployer...');
    const deployerWalletAddress = await jettonMinter.getWalletAddress(provider.sender().address!);
    console.log('Deployer Wallet Address:', deployerWalletAddress);

    console.log('Minting tokens to the deployer...');
    await jettonMinter.sendMint(provider.sender(), {
        toAddress: provider.sender().address!,
        jettonAmount: toNano('1000'),
        amount: toNano('0.25'),
        queryId: 1,
    });

    console.log('Deployment and initial minting completed.');
}