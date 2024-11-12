import { Address, toNano } from '@ton/core';
import { JettonMinter } from '../wrappers/JettonMinter';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const jettonMinterAddress = Address.parse('EQB6J_J2gdFW9zV9SP4D7xVdh0YRfIzKSq7D-rgXmhycpPoq'); // Replace with your actual minter address
    const jettonMinter = provider.open(JettonMinter.createFromAddress(jettonMinterAddress));

    console.log('Minting tokens...');

    await jettonMinter.sendMint(provider.sender(), {
        toAddress: provider.sender().address!,
        jettonAmount: toNano('1000'),
        amount: toNano('0.05'),
        queryId: Date.now(),
    });

    console.log('Minting transaction sent. Please check your wallet for the minted tokens.');
}