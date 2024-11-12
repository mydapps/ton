import { toNano, beginCell, Address, Dictionary, Cell } from '@ton/core';
import { JettonMinter } from '../wrappers/JettonMinter';
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

function parseTokenMetadataCell(contentCell: Cell): {
  [s in JettonMetaDataKeys]?: string;
} {
  const contentSlice = contentCell.beginParse();
  if (contentSlice.loadUint(8) !== ONCHAIN_CONTENT_PREFIX)
    throw new Error("Expected onchain content marker");

  const dict = contentSlice.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
  const res: { [s in JettonMetaDataKeys]?: string } = {};

  Object.keys(jettonOnChainMetadataSpec).forEach((k) => {
    const key = BigInt(`0x${sha256(k).toString("hex")}`);
    const value = dict.get(key);
    if (value) {
      const slice = value.beginParse();
      if (slice.loadUint(8) !== SNAKE_PREFIX)
        throw new Error("Only snake format is supported");
      const val = slice.loadStringTail();
      res[k as JettonMetaDataKeys] = val;
    }
  });

  return res;
}

export async function run(provider: NetworkProvider) {
    const jettonMinterCode = await compile('JettonMinter');
    const jettonWalletCode = await compile('JettonWallet');

    console.log('Deploying JettonMinter...');

    const metadata = {
        name: 'A testnet token',
        symbol: 'AXX',
        description: 'First Testnet implementation of testnet',
        image: 'https://dapps.social/icon.png'
    };

    const contentCell = buildTokenMetadataCell(metadata);

    const jettonMinter = provider.open(
        JettonMinter.createFromConfig(
            {
                adminAddress: provider.sender().address!,
                content: contentCell,
                jettonWalletCode: jettonWalletCode,
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
    console.log('- Content:', parseTokenMetadataCell(jettonData.content));

    console.log('Fetching wallet address for the deployer...');
    const deployerWalletAddress = await jettonMinter.getWalletAddress(provider.sender().address!);
    console.log('Deployer Wallet Address:', deployerWalletAddress);

    console.log('Adding initial liquidity of 0.1 TON...');
    try {
        await jettonMinter.sendBuyTokens(provider.sender(), {
            amount: toNano('0.1'),
            queryId: Date.now(),
        });
        console.log('Initial liquidity added. Please wait for confirmation.');
    } catch (buyError) {
        console.log('Error adding initial liquidity:', buyError instanceof Error ? buyError.message : String(buyError));
    }

    console.log('Fetching curve data...');
    const curveData = await jettonMinter.getCurveData();
    console.log('Curve Data:');
    console.log('- Curve Supply:', curveData.curveSupply);
    console.log('- Curve Balance:', curveData.curveBalance);

    console.log('Deployment and initial liquidity addition completed.');
}