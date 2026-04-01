import hardhatToolboxMochaEthersPlugin from '@nomicfoundation/hardhat-toolbox-mocha-ethers';
import { configVariable, defineConfig } from 'hardhat/config';

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
			//npx hardhat node https://mainnet.infura.io/v3/API_KEY --fork-block-number 22000000 --network hardhatMainnetFork
			type: 'edr-simulated',
			forking: {
				enabled: true,
				blockNumber: 22_000_000,
				// url: 'https://mainnet.infura.io/v3/cf34148b0b3045a4a09c292aa765d7d5',
				url: configVariable('MAINNET_RPC_URL'),
			},
		},
	},
});

