import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/types';
import { expect } from 'chai';
import { network } from 'hardhat';
import {
	AaveAdapterUSDC,
	MockUSDC,
	MockAaveToken,
	VaultPrudentGlUSDP,
} from '../../types/ethers-contracts/index.js';
import { Addressable, ContractTransactionResponse } from 'ethers';

const { ethers, networkHelpers } = await network.connect();

const currentBlock = await ethers.provider.getBlockNumber();
console.info(
	`⚠️\nLe Bloc actuel du réseau de test est ${currentBlock}\nRéseau ${
		(await ethers.provider.getNetwork()).name
	}`,
);

interface Accounts {
	owner: HardhatEthersSigner;
	dao: HardhatEthersSigner;
	newDao: HardhatEthersSigner;
	poorUser: HardhatEthersSigner;
	whale: HardhatEthersSigner;
}

let accounts: Accounts;
let usdcContract: MockUSDC;
let vaultPrudentGlUSDPContract: VaultPrudentGlUSDP;
let aaveAdapterUSDCContract: AaveAdapterUSDC;

describe('Contract deployment', ()=>{
    beforeEach(async ()=>{
        accounts = await getAccounts(false);
        usdcContract = await deployUSDCContract(false);
        vaultPrudentGlUSDPContract = await deployVaultPrudentGlUSDPContract(
            usdcContract.target,
            accounts.dao,
        );
        aaveAdapterUSDCContract = await deployAdapters(
            vaultPrudentGlUSDPContract.target,
        );
    })
    it('Should deploy the contract', async ()=>{
        
    })
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
})
describe('', ()=>{
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
})
describe('', ()=>{
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
})
describe('', ()=>{
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
})
describe('', ()=>{
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
    it('', async ()=>{
        
    })
})