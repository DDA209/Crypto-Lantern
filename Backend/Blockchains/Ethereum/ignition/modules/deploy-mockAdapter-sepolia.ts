import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const VAULT_PRUDENT_GLUSDP_SEPOLIA =
	'0xab539bcfbcaf4d7e1a1eb3a79dbaa6eb6e2aa37f';
const USDC_SEPOLIA = '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8';

export default buildModule('MockAdapterModule', (m) => {
	// 1. Définition des variables
	console.log('▶️ Start deploying Sepolia...');
	const mockadapter = m.contract('MockAdapter', [
		USDC_SEPOLIA,
		VAULT_PRUDENT_GLUSDP_SEPOLIA,
	]);

	return { mockadapter };
});

// npx hardhat ignition deploy ignition/modules/deploy-mockAdapter-sepolia.ts --network sepolia --verify --reset
// 0x39914a706FF75B603A584e75Bd8DA6fC68330352
