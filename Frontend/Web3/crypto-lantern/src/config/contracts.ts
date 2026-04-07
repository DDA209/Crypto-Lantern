import { ContractConfig } from '@/data/types/ContractConfig';

export const CONTRACT_CONFIG: Record<number, ContractConfig> = {
	31337: {
		name: 'Hardhat',
		vaultAddress: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
		fromBlock: 0n,
	},
	11155111: {
		name: 'Ethereum Sepolia',
		vaultAddress: '0xA7A7d5fE3AfB550959601c6FFf6541632dFf8C5B',
		fromBlock: 10000000n,
	},
	1: {
		name: 'Ethereum',
		vaultAddress: '0x...',
		fromBlock: 24000000n, // march 3rd 2026 2:45 PM UTC-0
	},
};
