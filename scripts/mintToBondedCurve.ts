import { Address, toNano } from '@ton/core';
import { JettonMinter } from '../wrappers/JettonMinter';
import { BondedCurve } from '../wrappers/BondedCurve';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const [jettonMinterAddress, bondedCurveAddress] = args;

    if (!jettonMinterAddress || !bondedCurveAddress) {
        console.error('Usage: blueprint run mintToBondedCurve <jettonMinterAddress> <bondedCurveAddress>');
        process.exit(1);
    }

    const jettonMinter = provider.open(JettonMinter.createFromAddress(Address.parse(jettonMinterAddress)));
    const bondedCurve = provider.open(BondedCurve.createFromAddress(Address.parse(bondedCurveAddress)));

    console.log('Minting tokens to Bonded Curve...');

    const totalSupply = toNano('1000000000'); // 1 billion tokens
    const initialLiquidity = toNano('1'); // 1 TON initial liquidity

    try {
        await jettonMinter.sendCreateToken(provider.sender(), {
            communityAdmin: provider.sender().address!,
            feeRecipient: provider.sender().address!,
            initialLiquidity: initialLiquidity,
            queryId: Date.now(),
        });
        console.log('Tokens minted and sent to Bonded Curve. Please wait for confirmation.');
        
    } catch (error) {
        console.error('Error minting tokens:', error);
        process.exit(1);
    }

    // Wait for the transaction to be processed
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for 10 seconds

    console.log('Fetching updated Jetton data...');
    try {
        const jettonData = await jettonMinter.getJettonData();
        console.log('Jetton Data:');
        console.log('- Total Supply:', jettonData.totalSupply.toString());
        console.log('- Admin Address:', jettonData.adminAddress.toString());
    } catch (error) {
        console.error('Error fetching Jetton data:', error);
    }

    console.log('Fetching updated Bonded Curve data...');
    try {
        const curveData = await bondedCurve.getCurveData();
        console.log('Curve Data:');
        console.log('- Total Supply:', curveData.totalSupply.toString());
        console.log('- Liquidity:', curveData.liquidity.toString());
    } catch (error) {
        console.error('Error fetching curve data:', error);
    }

    console.log('Attempting to fetch token data from Bonded Curve...');
    try {
        const tokenData = await bondedCurve.getTokenData(jettonMinter.address);
        console.log('Token Data in Bonded Curve:');
        console.log('- Total Supply:', tokenData.totalSupply.toString());
        console.log('- Liquidity:', tokenData.liquidity.toString());
        console.log('- Community Admin:', tokenData.communityAdmin.toString());
        console.log('- Fee Recipient:', tokenData.feeRecipient.toString());
        console.log('- Jetton Wallet Address:', tokenData.jettonWalletAddress.toString());
    } catch (tokenError) {
        console.error('Error fetching token data from Bonded Curve:', tokenError);
    }

    console.log('Minting process and data fetching completed.');
}