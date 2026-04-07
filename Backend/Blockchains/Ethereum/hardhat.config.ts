import hardhatToolboxMochaEthersPlugin from '@nomicfoundation/hardhat-toolbox-mocha-ethers';
import { configVariable, defineConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-verify';
import { isKeystoreJson } from 'ethers';

export default defineConfig({
	plugins: [hardhatToolboxMochaEthersPlugin],
	solidity: {
		profiles: {
			default: {
				version: '0.8.28',
				settings: {
					viaIR: true,
				},
			},
			production: {
				version: '0.8.28',
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
					viaIR: true,
				},
			},
		},
	},
	networks: {
		hardhat: {
			type: 'edr-simulated',
			chainType: 'l1',
			allowUnlimitedContractSize: true,
		},
		hardhatMainnet: {
			type: 'edr-simulated',
			chainType: 'l1',
		},
		hardhatOp: {
			type: 'edr-simulated',
			chainType: 'op',
		},
		sepolia: {
			type: 'http',
			chainType: 'l1',
			url: configVariable('SEPOLIA_RPC_URL'),
			accounts: [configVariable('SEPOLIA_PRIVATE_KEY')],
		},
		hardhatMainnetFork: {
			type: 'edr-simulated',
			forking: {
				enabled: true,
				blockNumber: 24_000_000,
				url: configVariable('MAINNET_RPC_URL'),
			},
		},
	},
	verify: {
		etherscan: {
			apiKey: configVariable('ETHERSCAN_API_KEY'),
		},
	},
});
