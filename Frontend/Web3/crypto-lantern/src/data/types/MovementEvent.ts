import { Address } from 'viem';

export type DepositWithdrawMovementEvent = {
	address: Address;
	assetsAmount: bigint;
	sharesAmount: bigint;
	blockNumber: number;
	type: 'deposit' | 'withdraw';
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
	newBuffer: bigint | undefined;
	currentTotalAssets: bigint | undefined;
	reinvestedAmout: bigint | undefined;
	blockNumber: number;
	transactionHash: `0x${string}`;
};
