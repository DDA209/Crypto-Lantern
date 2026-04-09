import { createPublicClient, http } from 'viem';
import { hardhat, mainnet, sepolia } from 'viem/chains';

export const publicClient = (
	chainId: number,
): ReturnType<typeof createPublicClient> => {
	let chain;
	let transport;

	switch (chainId) {
		case 1:
			chain = mainnet;
			transport = http(process.env.NEXT_PUBLIC_RPC_URL_MAINNET!);
			break;

		case 11155111:
			chain = sepolia;
			transport = http(process.env.NEXT_PUBLIC_RPC_URL_SEPOLIA!);
			break;

		case 31337:
		default:
			chain = hardhat;
			transport = http(process.env.NEXT_PUBLIC_RPC_URL_HARDHAT!);
			break;
	}

	return createPublicClient({ chain, transport });
};
