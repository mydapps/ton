import { toNano, beginCell, Address, Dictionary, Cell } from '@ton/core';
import { JettonMinter } from '../wrappers/JettonMinter';
import { BondedCurve } from '../wrappers/BondedCurve';
import { compile, NetworkProvider } from '@ton/blueprint';
import { Sha256 } from "@aws-crypto/sha256-js";

const ONCHAIN_CONTENT_PREFIX = 0x00;
const SNAKE_PREFIX = 0x00;

type JettonMetaDataKeys = "name" | "description" | "image" | "symbol";

const jettonOnChainMetadataSpec: {
  [key in JettonMetaDataKeys]: "utf8" | "ascii" | undefined;
} = {
  name: "utf8",
  description: "utf8",
  image: "ascii",
  symbol: "utf8",
};

const sha256 = (str: string) => {
  const sha = new Sha256();
  sha.update(str);
  return Buffer.from(sha.digestSync());
};

function buildTokenMetadataCell(data: { [s: string]: string | undefined }): Cell {
    const dict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
  
    Object.entries(data).forEach(([k, v]: [string, string | undefined]) => {
      if (!jettonOnChainMetadataSpec[k as JettonMetaDataKeys])
        throw new Error(`Unsupported onchain key: ${k}`);
      if (v === undefined || v === "") return;
  
      let bufferToStore = Buffer.from(v, jettonOnChainMetadataSpec[k as JettonMetaDataKeys]);
  
      const rootCell = beginCell();
      rootCell.storeUint(SNAKE_PREFIX, 8);
      rootCell.storeBuffer(bufferToStore);
  
      const key = BigInt(`0x${sha256(k).toString("hex")}`);
      dict.set(key, rootCell.endCell());
    });
  
    return beginCell().storeUint(ONCHAIN_CONTENT_PREFIX, 8).storeDict(dict).endCell();
}

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

export async function run(provider: NetworkProvider, args: string[]) {
    const [bondedCurveAddress] = args;

    if (!bondedCurveAddress) {
        console.error('Usage: blueprint run deployJettonMinter7 <bondedCurveAddress>');
        process.exit(1);
    }

    const jettonMinterCode = await compile('JettonMinter');
    const jettonWalletCode = await compile('JettonWallet');

    console.log('Deploying new JettonMinter...');

    const metadata = {
        name: 'New Testnet Token',
        symbol: 'NTK',
        description: 'A new testnet token with entire supply added to Bonded Curve',
        image: 'https://dapps.social/new-icon.png'
    };

    const contentCell = buildTokenMetadataCell(metadata);

    const jettonMinter = provider.open(
        JettonMinter.createFromConfig(
            {
                adminAddress: provider.sender().address!,
                content: contentCell,
                jettonWalletCode: jettonWalletCode,
                bondedCurveAddress: Address.parse(bondedCurveAddress),
            },
            jettonMinterCode
        )
    );

    console.log('JettonMinter address:', jettonMinter.address);
    console.log('BondedCurve address:', bondedCurveAddress);

    console.log('Sending JettonMinter deployment transaction...');
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

    console.log('Waiting for JettonMinter deployment...');
    await provider.waitForDeploy(jettonMinter.address);

    console.log('JettonMinter deployed at:', jettonMinter.address);

    // Mint the entire supply to the Bonded Curve
    const totalSupply = toNano('1000000000'); // 1 billion tokens
    console.log('Minting entire supply to Bonded Curve...');
    try {
        await jettonMinter.sendCreateToken(provider.sender(), {
            communityAdmin: provider.sender().address!,
            feeRecipient: provider.sender().address!,
            initialLiquidity: toNano('1'),
            queryId: Date.now(),
        });
        console.log('Create token transaction sent.');
    } catch (error) {
        console.error('Error minting tokens:', error);
        console.log('Error details:', JSON.stringify(bigIntToString(error), null, 2));
        process.exit(1);
    }

    console.log('Waiting for minting to complete...');
    for (let i = 0; i < 6; i++) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for 10 seconds
        console.log('Checking JettonMinter data...');
        try {
            const jettonData = await jettonMinter.getJettonData();
            console.log('JettonMinter data:', JSON.stringify(bigIntToString(jettonData), null, 2));
            if (jettonData.totalSupply > 0n) {
                console.log('Tokens minted successfully!');
                break;
            }
        } catch (error) {
            console.error('Error fetching JettonMinter data:', error);
        }
    }

    // Fetch and display the updated Bonded Curve data
    const bondedCurve = provider.open(BondedCurve.createFromAddress(Address.parse(bondedCurveAddress)));
    
    console.log('Fetching final JettonMinter data...');
    try {
        const jettonData = await jettonMinter.getJettonData();
        console.log('Final JettonMinter data:', JSON.stringify(bigIntToString(jettonData), null, 2));
    } catch (error) {
        console.error('Error fetching final JettonMinter data:', error);
    }

    console.log('Fetching updated curve data...');
    try {
        const curveData = await bondedCurve.getCurveData();
        console.log('Updated Curve Data:', JSON.stringify(bigIntToString(curveData), null, 2));
    } catch (error) {
        console.error('Error fetching curve data:', error);
        console.log('Attempting to fetch token data...');
        try {
            const tokenData = await bondedCurve.getTokenData(jettonMinter.address);
            console.log('Token Data:', JSON.stringify(bigIntToString(tokenData), null, 2));
        } catch (tokenError) {
            console.error('Error fetching token data:', tokenError);
        }
    }

    console.log('New token deployment and supply addition to Bonded Curve completed.');
}