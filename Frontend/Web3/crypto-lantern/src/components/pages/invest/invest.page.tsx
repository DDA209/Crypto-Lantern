'use client';

import { RiskProfile, VaultCard } from '@/components/ui/cards/VaultCard';
import {
	useAccount,
	useWriteContract,
	useWaitForTransactionReceipt,
	useReadContract,
} from 'wagmi';
import { useState } from 'react';
import usdcAbi from '@/context/USDC.json';
import { Address } from 'viem';
import { PROFILES } from '@/config/profiles';

const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as Address;

const RISK_PROFILES: RiskProfile[] = PROFILES.map((profile) => {
	return {
		id: profile.id,
		name: profile.name,
		icon: profile.icon,
		expectedApy: {calculateApy(profile.id)},
		isActive: profile.isActive,
		colorClass: profile.colorClass,
	};
});

const calculateApy = (profile: RiskProfile) => {
	
};

const usdcUserBalance = () => {
	const { address } = useAccount();
	const { data: usdcUserBalance, error, isLoading } = useReadContract({
		abi: usdcAbi,
		address: usdcAddress,
		functionName: 'balanceOf',
		args: [address],
	});
	return usdcUserBalance;
}
const userSharesTokenBalance = (riskProfileId: string) => {
	const { address } = useAccount();
	const { data: usdcUserBalance, error, isLoading } = useReadContract({
		abi: riskProfileId,
		address: usdcAddress,
		functionName: 'balanceOf',
		args: [address],
	});
	return usdcUserBalance;
}

const selectedRiskProfil = RISK_PROFILES[0];

const Invest = () => {
	const {
		data: usdcUserBalance,
		error,
		isLoading,
	} = useReadContract({
		abi: usdcAbi,
		address: usdcAddress,
		functionName: 'balanceOf',
		args: [address],
	});

	<>
		<VaultCard
			mode='deposit'
			networks={[{ id: 11155111, name: 'Sepolia' }]}
			profiles={RISK_PROFILES}
			balance={usdcUserBalance()}
			globalApy={4.52}
			onAction={(amount, profile) =>
				console.log(`Déposer ${amount} sur ${profile}`)
			}
			onRequestTestTokens={() => console.log('Mint Mock USDC')}
		/>
		<VaultCard
			mode='withdraw'
			networks={[{ id: 11155111, name: 'Sepolia' }]}
			profiles={RISK_PROFILES}
			balance={userSharesTokenBalance(selectedRiskProfil.id)}
			globalApy={4.52}
			onAction={(amount, profile) =>
				console.log(`Déposer ${amount} sur ${profile}`)
			}
			onRequestTestTokens={() => console.log('Mint Mock USDC')}
		/>
	</>;
};

export default Invest;
