import { Abi } from 'viem';
import { RiskProfileId } from '../types/RiskProfiileId';

/**
 * @description Risk profil
 * @export
 * @interface RiskProfile
 */
export interface RiskProfile {
	id: RiskProfileId;
	name: string;
	icon: string;
	expectedAPY: number | '--,--';
	assetsAmount: number | '- ---,--';
	sharesAmount: number | '- ---,--';
	isActive: boolean;
	colorClass?: string;
	vaultAddress?: `0x${string}`;
	vaultAbi?: Abi;
	assetSymbol?: string;
	shareSymbol?: string;
}
