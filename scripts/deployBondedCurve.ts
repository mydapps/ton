import { toNano, Address } from '@ton/core';
import { BondedCurve } from '../wrappers/BondedCurve';
import { compile, NetworkProvider } from '@ton/blueprint';

function bigIntToString(obj: any): any {
    if (typeof obj === 'bigint') {
        return obj.toString();
    }
    if (Array.isArray(obj)) {
        return obj.map(bigIntToString);
    }
    if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [key, bigIntToString(value)])
        );
    }
    return obj;
}

export async function run(provider: NetworkProvider) {
    const bondedCurveCode = await compile('BondedCurve');

    const adminAddress = provider.sender().address!;
    const jettonMinterAddress = Address.parse("EQBtTCDuEypmEXDNVa9tZ20UWPYuiOMpO3DfO1UFgi3qebXF");

    console.log('Deploying BondedCurve...');
    console.log('Admin address:', adminAddress.toString());
    console.log('JettonMinter address:', jettonMinterAddress.toString());

    const bondedCurve = provider.open(BondedCurve.createFromConfig({
        adminAddress: adminAddress,
        jettonMinter: jettonMinterAddress
    }, bondedCurveCode));

    console.log('BondedCurve address:', bondedCurve.address.toString());

    try {
        await bondedCurve.sendDeploy(provider.sender(), toNano('0.05'));
        console.log('Deploy transaction sent. Waiting for deployment...');
    } catch (error) {
        console.error('Error sending deploy transaction:', error);
        console.log('Error details:', JSON.stringify(error, null, 2));
        process.exit(1);
    }

    try {
        await provider.waitForDeploy(bondedCurve.address);
    } catch (error) {
        console.error('Error waiting for deployment:', error);
        console.log('Error details:', JSON.stringify(error, null, 2));
        process.exit(1);
    }

    console.log('BondedCurve deployed at:', bondedCurve.address.toString());

    console.log('Fetching BondedCurve data...');
    try {
        const contractData = await bondedCurve.getContractData();
        console.log('Contract data:', contractData.toString());
        
        const adminAddr = await bondedCurve.getAdminAddress();
        console.log('Admin address from contract:', adminAddr.toString());

        const jettonMinter = await bondedCurve.getJettonMinter();
        console.log('JettonMinter address from contract:', jettonMinter.toString());

        const curveData = await bondedCurve.getCurveData();
        console.log('Curve Data:', JSON.stringify(bigIntToString(curveData), null, 2));
    } catch (error) {
        console.error('Error fetching BondedCurve data:', error);
        console.log('Error details:', JSON.stringify(bigIntToString(error), null, 2));
    }

    console.log('BondedCurve deployment completed. It is now ready to manage multiple jetton tokens.');
}