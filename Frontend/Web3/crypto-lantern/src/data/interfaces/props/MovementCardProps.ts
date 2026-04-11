import { Abi, Address } from 'viem';
import { RiskProfile } from '../vault';

interface MovementCardProps {
	mode: 'deposit' | 'withdraw';
	profiles: RiskProfile[];
	balance: string;
	chainId: number;
	globalAPY?: number;
	userAPY?: number;
	assetSymbol: string;
	shareSymbol: string;
	vaultAddress: Address;
	vaultAbi: Abi;
	assetAddress: Address;
	span: number;
	onAction?: (amount: string, profileId: string) => void;
	onRequestMockTokens?: () => void;
	onRequestTestTokens?: () => void;
	refetch: () => void;
	getEvents: () => void;
}

export default MovementCardProps;
