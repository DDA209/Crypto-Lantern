import { RiskProfile } from '@/data/interfaces/vault';
import vaultPrudentGlUSDP from '@/context/VaultPrudentGlUSDP.json';
import { Abi } from 'viem';
import { NETWORK_CONFIG } from '@/config/NetworkConfig';

export const getProfiles = (chainId: number): RiskProfile[] => [
	{
		id: 'glUSD-P',
		name: 'Prudent',
		icon: '🛡️',
		expectedAPY: 0,
		assetsAmount: 0,
		sharesAmount: 0,
		isActive: true,
		colorClass: 'bg-green-500',
		vaultAbi: vaultPrudentGlUSDP as unknown as Abi,
		vaultAddress: NETWORK_CONFIG[chainId]?.vaultPrudentGlUSDP,
		assetSymbol: 'USDC',
		shareSymbol: 'glUSD-P',
	},
	{
		id: 'glUSD-B',
		name: 'Balanced',
		icon: '⚖️',
		expectedAPY: '--,--',
		assetsAmount: '- ---,--',
		sharesAmount: '- ---,--',
		isActive: false,
		colorClass: 'bg-yellow-500',
		assetSymbol: 'USDC',
		shareSymbol: 'glUSD-B',
	},
	{
		id: 'glUSD-D',
		name: 'Dynamic',
		icon: '⚡',
		expectedAPY: '--,--',
		assetsAmount: '- ---,--',
		sharesAmount: '- ---,--',
		isActive: false,
		colorClass: 'bg-orange-500',
		assetSymbol: 'USDC',
		shareSymbol: 'glUSD-D',
	},
	{
		id: 'glUSD-AH',
		name: 'AirDrop Hunter',
		icon: '🚀',
		expectedAPY: '--,--',
		assetsAmount: '- ---,--',
		sharesAmount: '- ---,--',
		isActive: false,
		colorClass: 'bg-red-500',
		assetSymbol: 'USDC',
		shareSymbol: 'glUSD-AH',
	},
];
