import { Address, toNano } from '@ton/core';
import { JettonMinter } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const jettonMinterAddress = Address.parse('EQAeEAKyetWBNUp0CeTDYHeukL3emOWCH7qNPLQV3an6nEUw');
    const jettonMinter = provider.open(JettonMinter.createFromAddress(jettonMinterAddress));

    console.log('Fetching Jetton data...');
    const jettonData = await jettonMinter.getJettonData();

    console.log('Jetton Data:');
    console.log('- Total Supply:', jettonData.totalSupply);
    console.log('- Mintable:', jettonData.mintable);
    console.log('- Admin Address:', jettonData.adminAddress);

    console.log('Metadata:');
    console.log(jettonData.content.toString());

    const userAddress = provider.sender().address!;
    console.log('User Address:', userAddress);

    const userWalletAddress = await jettonMinter.getWalletAddress(userAddress);
    console.log('User Jetton Wallet Address:', userWalletAddress);

    // Check if user wallet exists
    const userWalletContract = provider.open(JettonWallet.createFromAddress(userWalletAddress));
    
    try {
        const userBalance = await userWalletContract.getJettonBalance();
        console.log('User Jetton Balance:', userBalance);
    } catch (error) {
        console.log('Error fetching user balance. Wallet might not be initialized.');
        console.log('Attempting to mint initial tokens...');
        try {
            await jettonMinter.sendMint(provider.sender(), {
                toAddress: userAddress,
                jettonAmount: toNano('10'),
                amount: toNano('0.05'),
                queryId: Date.now(),
            });
            console.log('Minting transaction sent. Please wait for confirmation and run this script again.');
        } catch (mintError) {
            console.log('Error minting tokens:', mintError instanceof Error ? mintError.message : String(mintError));
        }
    }
}