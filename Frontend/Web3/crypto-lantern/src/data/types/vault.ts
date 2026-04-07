export type RiskProfileId = 'glUSD-P' | 'glUSD-B' | 'glUSD-D' | 'glUSD-AH';

/**
 * @description Risk profil
 * @export
 * @interface RiskProfile
 */
export interface RiskProfile {
	id: RiskProfileId;
	name: string;
	icon: string;
	expectedApy: string;
	isActive: boolean;
	colorClass?: string;
	vaultAddress?: `0x${string}`;
	abvaultAbii: string;
}
