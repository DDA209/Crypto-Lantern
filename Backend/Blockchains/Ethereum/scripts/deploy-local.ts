import { network } from 'hardhat';
import {
	MockAdapter,
	MockERC20,
	VaultPrudentGlUSDP,
} from '../types/ethers-contracts/index.js';

const { ethers } = await network.connect();

console.log('▶️ Start deploying local...\n');

// 1. Local accounts
const [owner, dao, team, whale] = await ethers.getSigners();

// 2. Deploy Mock USDC
console.log('\n🔘🔘🔘🔘🔘🔘 Deploying MockERC20 USDC...');
let mockUSDC: MockERC20;
try {
	mockUSDC = await ethers.deployContract('MockERC20', [
		'Mock USD',
		'USDC',
		6,
	]);
	console.log(`✅ MockERC20 (USDC) deployed on : ${mockUSDC.target}`);
} catch (error) {
	console.log(`⛔ MockERC20 (USDC) deployment failed: ${error}`);
	process.exit(1);
}

// 3. Deploy Vault
let vault: VaultPrudentGlUSDP;
let deployBlockNumber: number;
console.log('\n🟢🔘🔘🔘🔘🔘 Deploying VaultPrudentGlUSDP...');
try {
	vault = await ethers.deployContract('VaultPrudentGlUSDP', [
		mockUSDC.target,
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

// 4. Deploy MockAdapter
let mockAdapter: MockAdapter;
console.log('\n🟢🟢🔘🔘🔘🔘 Deploying MockAdapter...');
try {
	mockAdapter = await ethers.deployContract('MockAdapter', [
		mockUSDC.target,
		vault.target,
	]);
	console.log(`✅ MockAdapter deployed on : ${mockAdapter.target}\n`);
} catch (error) {
	console.log(`⛔ MockAdapter deployment failed: ${error}`);
	process.exit(1);
}

// 5. Configuration of strategies by the DAO
console.log('\n🟢🟢🟢🔘🔘🔘 Configuring strategies by the DAO...');
const strategies = [
	{
		adapter: mockAdapter.target,
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

// 6. Minting mock USDC for Front-End tests
console.log('\n🟢🟢🟢🟢🔘🔘 Creating liquidity for Front-End tests...');
const mintAmount = ethers.parseUnits('100000', 6);
try {
	await mockUSDC.mint(owner.address, mintAmount);
	await mockUSDC.mint(whale.address, mintAmount);
	console.log(
		`✅ ${ethers.formatUnits(mintAmount, 6)} USDC sent to the Owner`,
	);
	console.log(
		`✅ ${ethers.formatUnits(mintAmount, 6)} USDC sent to the Whale`,
	);
} catch (error) {
	console.log(`⛔ Minting failed: ${error}`);
	process.exit(1);
}

// 7. Inflation attack insurance
console.log('\n🟢🟢🟢🟢🟢🔘 Inflation attack insurance...');
const initialDepositAmount = ethers.parseUnits('10', 6); // 10 USDC
await mockUSDC.approve(vault.target, initialDepositAmount);
await vault.deposit(
	initialDepositAmount,
	'0x000000000000000000000000000000000000dEaD',
);
console.log(`✅ ${ethers.formatUnits(initialDepositAmount, 6)} USDC deposited`);

console.log('\n🟢🟢🟢🟢🟢🟢 Local deployment completed');
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
console.log(
	`NEXT_PUBLIC_VAULT_PRUDENT_GLUSDP_ADDRESS_HARDHAT='${vault.target}'`,
);
console.log(`NEXT_PUBLIC_MOCK_ADAPTER_ADDRESS_HARDHAT='${mockAdapter.target}'`);
console.log(`NEXT_PUBLIC_USDC_ADDRESS_HARDHAT='${mockUSDC.target}'`);
console.log(`NEXT_PUBLIC_BLOCK_NUMBER_HARDHAT=${deployBlockNumber}`);
console.log(`RPC_URL_HARDHAT='http://127.0.0.1:8545/'`);
console.log(
	'======================================================================',
);

process.exit(0);

// npx hardhat run scripts/deploy-local.ts --network localhost
