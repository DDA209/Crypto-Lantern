import { Address } from 'viem';

interface LanternContextType {
	isConnected: boolean;
	userAddress: Address | undefined;
	vaultPrudentGlUSDPAddress: Address | undefined;
	usdcAddress: Address | undefined;
	aaveUSDCOwner: Address | undefined;
	isDao: boolean;
	isNewDao: boolean;
	isTeam: boolean;
	isNewTeam: boolean;
}

export default LanternContextType;
