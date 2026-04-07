import { RiskProfile } from '@/data/types/vault';
import vaultPrudentGlUSDP from '@/context/VaultPrudentGlUSDP.json';

export const PROFILES: RiskProfile[] = [
	{
		id: 'glUSD-P',
		name: 'Prudent',
		icon: '🛡️',
		expectedApy: '',
		isActive: true,
		colorClass: 'bg-green-500',
		vaultAbi: vaultPrudentGlUSDP,
	},
	{
		id: 'glUSD-B',
		name: 'Balanced',
		icon: '⚖️',
		expectedApy: '--,--%',
		isActive: false,
		colorClass: 'bg-yellow-500',
		vaultAbi: '',
	},
	{
		id: 'glUSD-D',
		name: 'Dynamic',
		icon: '⚡',
		expectedApy: '--,--%',
		isActive: false,
		colorClass: 'bg-orange-500',
		vaultAbi: '',
	},
	{
		id: 'glUSD-AH',
		name: 'Aggressive',
		icon: '🚀',
		expectedApy: '--,--%',
		isActive: false,
		colorClass: 'bg-red-500',
		vaultAbi: '',
	},
];
