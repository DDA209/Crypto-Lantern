'use client';

import React, { createContext, useContext } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Address } from 'viem';
import VaultPrudentGlUSDPABI from './VaultPrudentGlUSDP.json';
import LanternContextType from '@/data/interfaces/LanternContext';

const LanternContext = createContext<LanternContextType>({
	isConnected: false,
	userAddress: undefined,
	vaultPrudentGlUSDPAddress: undefined,
	usdcAddress: undefined,
	aaveUSDCOwner: undefined,
	isDao: false,
	isNewDao: false,
	isTeam: false,
	isNewTeam: false,
});

const getContractsAddress = (chainId?: number) => {
	switch (chainId) {
		case 1:
			console.warn('MAINNET', chainId);
			return {
				vaultPrudentGlUSDPAddress: process.env
					.NEXT_PUBLIC_VAULT_PRUDENT_GLUSDP_ADDRESS_MAINNET as Address,
				usdcAddress: process.env
					.NEXT_PUBLIC_USDC_ADDRESS_MAINNET as Address,
			};
		case 11155111:
			console.warn('SEPOLIA', chainId);
			return {
				vaultPrudentGlUSDPAddress: process.env
					.NEXT_PUBLIC_VAULT_PRUDENT_GLUSDP_ADDRESS_SEPOLIA as Address,
				usdcAddress: process.env
					.NEXT_PUBLIC_USDC_ADDRESS_SEPOLIA as Address,
				aaveUSDCOwner: process.env
					.NEXT_PUBLIC_AAVE_USDC_OWNER_SEPOLIA as Address,
			};
		case 31337:
			console.warn('HARDHAT', chainId);
		default:
			console.warn('ANOTHER CHAIN', chainId);
			return {
				vaultPrudentGlUSDPAddress: process.env
					.NEXT_PUBLIC_VAULT_PRUDENT_GLUSDP_ADDRESS_HARDHAT as Address,
				usdcAddress: process.env
					.NEXT_PUBLIC_USDC_ADDRESS_HARDHAT as Address,
			};
	}
};

export const LanternProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const { address: userAddress, isConnected, chainId } = useAccount();
	const { vaultPrudentGlUSDPAddress, usdcAddress, aaveUSDCOwner } =
		getContractsAddress(chainId);

	const baseConfig = {
		address: vaultPrudentGlUSDPAddress,
		abi: VaultPrudentGlUSDPABI,
		query: { enabled: isConnected && !!vaultPrudentGlUSDPAddress },
	};

	const { data: daoAddress } = useReadContract({
		...baseConfig,
		functionName: 'daoAddress',
	});
	const { data: newDaoAddress } = useReadContract({
		...baseConfig,
		functionName: 'newDaoAddress',
	});
	const { data: teamAddress } = useReadContract({
		...baseConfig,
		functionName: 'teamAddress',
	});
	const { data: newTeamAddress } = useReadContract({
		...baseConfig,
		functionName: 'newTeamAddress',
	});

	return (
		<LanternContext.Provider
			value={{
				isConnected,
				userAddress,
				vaultPrudentGlUSDPAddress,
				usdcAddress,
				aaveUSDCOwner: aaveUSDCOwner,
				isDao: isConnected && daoAddress === userAddress,
				isNewDao: isConnected && newDaoAddress === userAddress,
				isTeam: isConnected && teamAddress === userAddress,
				isNewTeam: isConnected && newTeamAddress === userAddress,
			}}
		>
			{children}
		</LanternContext.Provider>
	);
};

export const useLantern = () => useContext(LanternContext);

export default LanternProvider;
