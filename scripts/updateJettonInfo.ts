import { toNano, beginCell, Address, Dictionary, Cell } from '@ton/core';
import { JettonMinter } from '../wrappers/JettonMinter';
import { NetworkProvider } from '@ton/blueprint';
import BN from 'bn.js';

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

function buildTokenMetadataCell(data: { [s: string]: string | undefined }): Cell {
  const KEYLEN = 256;
  const dict = Dictionary.empty(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());

  Object.entries(data).forEach(([k, v]: [string, string | undefined]) => {
    if (!jettonOnChainMetadataSpec[k as JettonMetaDataKeys])
      throw new Error(`Unsupported onchain key: ${k}`);
    if (v === undefined || v === "") return;

    let bufferToStore = Buffer.from(v, jettonOnChainMetadataSpec[k as JettonMetaDataKeys]);
    const rootCell = beginCell().storeUint(SNAKE_PREFIX, 8).storeBuffer(bufferToStore).endCell();
    dict.set(Buffer.from(k.padEnd(32, '\0')), rootCell);
  });

  return beginCell().storeUint(ONCHAIN_CONTENT_PREFIX, 8).storeDict(dict).endCell();
}

function parseTokenMetadataCell(contentCell: Cell): { [s in JettonMetaDataKeys]?: string } {
  const res: { [s in JettonMetaDataKeys]?: string } = {};
  const cs = contentCell.beginParse();
  
  if (cs.loadUint(8) !== ONCHAIN_CONTENT_PREFIX)
    throw new Error("Expected onchain content marker");

  const dict = cs.loadDict(Dictionary.Keys.Buffer(32), Dictionary.Values.Cell());
  for (const [key, value] of dict) {
    const keyStr = key.toString().replace(/\0+$/, '') as JettonMetaDataKeys;
    if (jettonOnChainMetadataSpec[keyStr]) {
      const valueCell = value.beginParse();
      const prefix = valueCell.loadUint(8);
      if (prefix !== SNAKE_PREFIX) throw new Error("Only snake format is supported");
      const valueStr = valueCell.loadStringTail();
      res[keyStr] = valueStr;
    }
  }

  return res;
}

export async function run(provider: NetworkProvider) {
  const jettonMinterAddress = Address.parse('EQB6J_J2gdFW9zV9SP4D7xVdh0YRfIzKSq7D-rgXmhycpPoq');
  const jettonMinter = provider.open(JettonMinter.createFromAddress(jettonMinterAddress));

  console.log('Fetching current Jetton data...');
  const currentJettonData = await jettonMinter.getJettonData();
  console.log('Current Jetton Data:');
  console.log('- Total Supply:', currentJettonData.totalSupply);
  console.log('- Mintable:', currentJettonData.mintable);
  console.log('- Admin Address:', currentJettonData.adminAddress);
  
  const currentMetadata = parseTokenMetadataCell(currentJettonData.content);
  console.log('Current Metadata:');
  console.log(currentMetadata);
  console.log('Current Raw Metadata:');
  console.log(currentJettonData.content.toBoc().toString('base64'));

  console.log('\nModifying JettonMinter metadata...');

  const newMetadata = {
    name: 'Awesome Token',
    symbol: 'AWS',
    description: 'This is an awesome TON Jetton token with updated metadata',
    image: 'https://example.com/updated-logo.png',
  };

  const contentCell = buildTokenMetadataCell(newMetadata);

  console.log('Sending metadata update transaction...');
  await jettonMinter.send(
    provider.sender(),
    {
      value: toNano('0.25'),
    },
    {
      $$type: 'ChangeContent',
      content: contentCell
    }
  );

  console.log('Waiting for transaction to complete...');
  await provider.waitForDeploy(jettonMinterAddress);

  console.log('Metadata update completed.');

  console.log('\nFetching updated Jetton data...');
  const updatedJettonData = await jettonMinter.getJettonData();
  console.log('Updated Jetton Data:');
  console.log('- Total Supply:', updatedJettonData.totalSupply);
  console.log('- Mintable:', updatedJettonData.mintable);
  console.log('- Admin Address:', updatedJettonData.adminAddress);
  
  const updatedMetadata = parseTokenMetadataCell(updatedJettonData.content);
  console.log('Updated Metadata:');
  console.log(updatedMetadata);
  console.log('Updated Raw Metadata:');
  console.log(updatedJettonData.content.toBoc().toString('base64'));

  console.log('\nMetadata modification completed.');
}