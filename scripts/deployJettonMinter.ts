import { toNano, beginCell, Address } from '@ton/core';
import { JettonMinter } from '../wrappers/JettonMinter';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const jettonMinterCode = await compile('JettonMinter');
    const jettonWalletCode = await compile('JettonWallet');

    console.log('Deploying JettonMinter...');

    const jettonMinter = provider.open(
        JettonMinter.createFromConfig(
            {
                adminAddress: provider.sender().address!,
                content: beginCell().storeUint(0, 8).endCell(),
                jettonWalletCode: jettonWalletCode,
                metadata: {
                    name: "Awesome",
                    symbol: "ATD",
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

    // Print the address of the deployed contract
    console.log('JettonMinter deployed at:', jettonMinter.address);

    // Fetch and log Jetton data
    console.log('Fetching Jetton data...');
    const jettonData = await jettonMinter.getJettonData();
    console.log('Jetton Data:');
    console.log('- Total Supply:', jettonData.totalSupply);
    console.log('- Mintable:', jettonData.mintable);
    console.log('- Admin Address:', jettonData.adminAddress);
    console.log('- Content:', jettonData.content);

    // Fetch and log wallet address for the deployer
    console.log('Fetching wallet address for the deployer...');
    const deployerWalletAddress = await jettonMinter.getWalletAddress(provider.sender().address!);
    console.log('Deployer Wallet Address:', deployerWalletAddress);

    // Mint some tokens to the deployer
    console.log('Minting tokens to the deployer...');
    await jettonMinter.sendMint(provider.sender(), {
        toAddress: provider.sender().address!,
        jettonAmount: toNano('1000'), // Minting 1000 tokens
        amount: toNano('0.25'), // Transaction fee
        queryId: 1,
    });

    console.log('Deployment and initial minting completed.');
}