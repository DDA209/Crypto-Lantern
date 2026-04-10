import { NetworkConfig } from '@/data/interfaces/NetworkConfig';

export const NETWORK_CONFIG: Record<number, NetworkConfig> = {
	31337: {
		name: 'Hardhat',
		vaultPrudentGlUSDP: process.env
			.NEXT_PUBLIC_VAULT_PRUDENT_GLUSDP_ADDRESS_HARDHAT as
			| `0x${string}`
			| undefined,
		usdcAddress: process.env.NEXT_PUBLIC_USDC_ADDRESS as
			| `0x${string}`
			| undefined,
		fromBlock: BigInt(process.env.NEXT_PUBLIC_BLOCK_NUMBER_HARDHAT ?? 0),
	},
	11155111: {
		name: 'Ethereum Sepolia',
		vaultPrudentGlUSDP: process.env
			.NEXT_PUBLIC_VAULT_PRUDENT_GLUSDP_ADDRESS_SEPOLIA as `0x${string}`,
		usdcAddress: process.env
			.NEXT_PUBLIC_USDC_ADDRESS_SEPOLIA as `0x${string}`,
		fromBlock: BigInt(
			process.env.NEXT_PUBLIC_BLOCK_NUMBER_SEPOLIA ?? 10000000,
		),
	},
	1: {
		name: 'Ethereum',
		vaultPrudentGlUSDP: process.env
			.NEXT_PUBLIC_VAULT_PRUDENT_GLUSDP_ADDRESS_MAINNET as `0x${string}`,
		usdcAddress: process.env
			.NEXT_PUBLIC_USDC_ADDRESS_MAINNET as `0x${string}`,
		fromBlock: BigInt(
			process.env.NEXT_PUBLIC_BLOCK_NUMBER_LOCAL_MAINNET ?? 24000001,
		),
	},
};
