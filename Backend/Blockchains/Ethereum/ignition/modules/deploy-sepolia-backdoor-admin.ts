import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

// Sepolia Addresses: (doc: https://aave.com/docs/resources/addresses)
const USDC_SEPOLIA = '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8';
const FAKE_ADAPTER_AAVEE_SEPOLIA = '0x39914a706FF75B603A584e75Bd8DA6fC68330352';

// DAO address
const DAO_ADDRESS = '0x97b3b90a0d8B7fB3194a156980c6cA2FdBBF7EAe';
const TEAM_ADDRESS = '0x97b3b90a0d8B7fB3194a156980c6cA2FdBBF7EAe';

export default buildModule('VaultPrudentGlUSDPBackdoorAdminModule', (m) => {
	// 1. Définition des variables
	console.log('▶️ Start deploying Sepolia...');

	const feesBIPS = 500n; // 5%
	const bufferBIPS = 1000n; // 10%

	// 2. Deploy Vault
	// Batch #1
	const vault = m.contract('VaultPrudentGlUSDPBackdoorAdmin', [
		USDC_SEPOLIA,
		DAO_ADDRESS,
		TEAM_ADDRESS,
		feesBIPS,
		bufferBIPS,
	]);

	// 3. Configuration of strategies by the DAO
	// Batch #2
	m.call(
		vault,
		'defineStrategies',
		[
			[
				{
					adapter: FAKE_ADAPTER_AAVEE_SEPOLIA,
					repartitionBIPS: 10000n,
					deltaBIPS: 500n,
				},
			],
		],
		{
			from: DAO_ADDRESS,
		},
	);

	// 5. Deposit and burning first USDCs to prevent inflation attacks
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

	return { vault };
});

// npx hardhat ignition deploy ignition/modules/deploy-sepolia-backdoor-admin.ts --network sepolia --verify --reset
