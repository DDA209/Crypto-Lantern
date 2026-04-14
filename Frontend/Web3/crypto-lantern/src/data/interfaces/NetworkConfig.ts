export interface NetworkConfig {
	vaultPrudentGlUSDP?: `0x${string}`;
	vaultBalancedGlUSDB?: `0x${string}`;
	vaultDynamicGlUSDD?: `0x${string}`;
	vaultRewardsHunterGlUSDAH?: `0x${string}`;
	usdcAddress?: `0x${string}`;
	fromBlock: bigint;
	name: string;
}
