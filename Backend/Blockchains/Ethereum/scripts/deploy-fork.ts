import { network } from 'hardhat';
import {
	AaveAdapterUSDC,
	VaultPrudentGlUSDP,
} from '../types/ethers-contracts/index.js';

const { ethers, networkHelpers } = await network.connect({
	network: 'hardhatMainnetFork',
	chainType: 'l1',
});

const prodAddresses = {
	usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
	aUSDC: '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c',
	aaveLendingPool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
	whale: '0x38AAEF3782910bdd9eA3566C839788Af6FF9B200', //2_664_559_519.701 USDC
};

console.log('▶️ Start deploying local mainnet fork...\n');

// 1. Local accounts
const [owner, dao, team] = await ethers.getSigners();

// 2. Whale account
await ethers.getImpersonatedSigner(prodAddresses.whale);
const whale = await ethers.getSigner(prodAddresses.whale);
await networkHelpers.setBalance(whale.address, ethers.parseEther('1.1'));

// 3. Deploy Vault
let vault: VaultPrudentGlUSDP;
let deployBlockNumber: number;
console.log('\n🔘🔘🔘 Deploying VaultPrudentGlUSDP...');
try {
	vault = await ethers.deployContract('VaultPrudentGlUSDP', [
		prodAddresses.usdc,
		dao.address,
		team.address,
		500n,
		1000n,
	]);
	deployBlockNumber = await ethers.provider.getBlockNumber();
	console.log(`✅ Vault deployed on : ${vault.target}`);
} catch (error) {
	console.log(`⛔ Vault deployment failed: ${error}`);
	process.exit(1);
}

// 4. Deploy AaveAdapter
let aaveAdapterUSDC: AaveAdapterUSDC;
console.log('\n🟢🔘🔘 Deploying AaveAdapterUSDC...');
try {
	aaveAdapterUSDC = await ethers.deployContract('AaveAdapterUSDC', [
		prodAddresses.usdc,
		prodAddresses.aUSDC,
		prodAddresses.aaveLendingPool,
		vault.target,
	]);
	console.log(`✅ AaveAdapterUSDC deployed on : ${aaveAdapterUSDC.target}\n`);
} catch (error) {
	console.log(`⛔ AaveAdapterUSDC deployment failed: ${error}`);
	process.exit(1);
}

// 5. Configuration of strategies by the DAO
console.log('\n🟢🟢🔘 Configuring strategies by the DAO...');
const strategies = [
	{
		adapter: aaveAdapterUSDC.target,
		repartitionBIPS: 10000n,
		deltaBIPS: 500n,
	},
];
try {
	const defineTx = await vault.connect(dao).defineStrategies(strategies);
	await defineTx.wait();
	console.log('✅ Strategy defined with success!');
} catch (error) {
	console.log(`⛔ Strategy definition failed: ${error}`);
	process.exit(1);
}

console.log('\n🟢🟢🟢 Local deployment completed');
console.table({
	owner: owner.address,
	dao: dao.address,
	team: team.address,
	whale: whale.address,
});
console.log(
	'======================================================================',
);
console.log('Local values to copy to the Front-End (.env.local) :');
console.log(`NEXT_PUBLIC_USDC_ADDRESS_HARDHAT=${prodAddresses.usdc}`);
console.log(`NEXT_PUBLIC_VAULT_PRUDENT_GLUSDP_ADDRESS_HARDHAT=${vault.target}`);
console.log(`NEXT_PUBLIC_BLOCK_NUMBER_HARDHAT=${deployBlockNumber}`);
console.log(
	'======================================================================',
);

process.exit(0);

// npx hardhat run scripts/deploy-fork.ts --network hardhatMainnetFork
