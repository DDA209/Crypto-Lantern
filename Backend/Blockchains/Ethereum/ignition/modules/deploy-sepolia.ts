import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

// Sepolia Addresses: (doc: https://aave.com/docs/resources/addresses)
const USDC_SEPOLIA = '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8';
const AUSDC_SEPOLIA = '0x16dA4541aD1807f4443d92D26044C1147406EB80';
const AAVE_POOL_SEPOLIA = '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951';

// DAO address
const DAO_ADDRESS = '0x97b3b90a0d8B7fB3194a156980c6cA2FdBBF7EAe';
const TEAM_ADDRESS = '0x97b3b90a0d8B7fB3194a156980c6cA2FdBBF7EAe';

export default buildModule('VaultPrudentGlUSDPModule', (m) => {
	console.log('▶️ Start deploying Sepolia...');

	const feesBIPS = 500n; // 5%
	const bufferBIPS = 1000n; // 10%

	// 2. Deploy Vault
	// Batch #1
	const vault = m.contract('VaultPrudentGlUSDP', [
		USDC_SEPOLIA,
		DAO_ADDRESS,
		TEAM_ADDRESS,
		feesBIPS,
		bufferBIPS,
	]);
	// const deployBlockNumber = m.staticCall(vault, 'blockNumber', []);
	// console.log(`NEXT_PUBLIC_BLOCK_NUMBER_SEPOLIA=${deployBlockNumber}`);

	// 3. Deploy AaveAdapter
	// Batch #2
	const aaveAdapter = m.contract('AaveAdapterUSDC', [
		USDC_SEPOLIA,
		AUSDC_SEPOLIA,
		AAVE_POOL_SEPOLIA,
		vault,
	]);

	// 4. Configuration of strategies by the DAO
	// Batch #3
	m.call(
		vault,
		'defineStrategies',
		[
			[
				{
					adapter: aaveAdapter,
					repartitionBIPS: 10000n,
					deltaBIPS: 500n,
				},
			],
		],
		{
			from: DAO_ADDRESS,
		},
	);

	// 5. Deposit and burning first USDCs to prevent
	const usdc = m.contractAt('IERC20', USDC_SEPOLIA);

	const initialDepositAmount = 10_000_000n; // 10 USDC (avec 6 décimales)
	const deadAddress = '0x000000000000000000000000000000000000dEaD';

	const approveCall = m.call(usdc, 'approve', [vault, initialDepositAmount], {
		id: 'ApproveUSDCForDeadShares',
	});

	m.call(vault, 'deposit', [initialDepositAmount, deadAddress], {
		id: 'MintDeadShares',
		after: [approveCall],
	});

	return { vault, aaveAdapter };
});

// npx hardhat ignition deploy ignition/modules/deploy-sepolia.ts --network sepolia --verify --reset
