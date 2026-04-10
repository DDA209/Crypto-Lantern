import { Address } from 'viem';

export type MovementEvent = {
	address: Address;
	assetsAmount: bigint;
	sharesAmount: bigint;
	blockNumber: number;
	type: 'Dépôt' | 'Retrait';
	transactionHash: `0x${string}`;
};

export type HarvestMovementEvent = {
	yield: bigint | undefined;
	fees: bigint | undefined;
	sharesToMint: bigint | undefined;
	totalAssets: bigint | undefined;
	blockNumber: number;
	transactionHash: `0x${string}`;
};

export type RebalanceMovementEvent = {
	force: boolean | undefined;
	currentTotalAssets: bigint | undefined;
	newBuffer: bigint | undefined;
	divestedAmout: bigint | undefined;
	reinvestedAmout: bigint | undefined;
	blockNumber: number;
	transactionHash: `0x${string}`;
};
