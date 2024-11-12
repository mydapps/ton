import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { BondedCurve } from '../wrappers/BondedCurve';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('BondedCurve', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('BondedCurve');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let bondedCurve: SandboxContract<BondedCurve>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        bondedCurve = blockchain.openContract(BondedCurve.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await bondedCurve.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: bondedCurve.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and bondedCurve are ready to use
    });
});
