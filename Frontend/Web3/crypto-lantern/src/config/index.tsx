import { cookieStorage, createStorage } from '@wagmi/core';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { hardhat, sepolia } from '@reown/appkit/networks';
import { Address } from 'viem';

// Get projectId from https://dashboard.reown.com
export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

if (!projectId) {
	throw new Error('Project ID is not defined');
}

export const networks = [hardhat, sepolia];

//Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
	storage: createStorage({ storage: cookieStorage }),
	ssr: true,
	projectId,
	networks,
});

export const appName: string = 'DeFi Lantern';

export const appDescription: string =
	'A decentralised lending and borrowing application';

export const config = wagmiAdapter.wagmiConfig;

export const devContractAddress = process.env
	.NEXT_PUBLIC_CONTRACT_ADDRESS_DEV as Address;

export const prodContractAddress = process.env
	.NEXT_PUBLIC_CONTRACT_ADDRESS_PROD as Address;
