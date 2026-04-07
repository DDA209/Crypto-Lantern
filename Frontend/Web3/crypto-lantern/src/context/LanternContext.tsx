'use client';

import React, { createContext, useContext } from 'react';
import { useConnection, useReadContract } from 'wagmi';
import { Address } from 'viem';
import VaultPrudentGlUSDPABI from './VaultPrudentGlUSDP.json';

interface LanternContextType {
	isConnected: boolean;
	address: Address | undefined;
	isDao: boolean;
	isNewDao: boolean;
	isUser: boolean;
}

const LanternContext = createContext<LanternContextType>({
	isConnected: false,
	address: undefined,
	isDao: false,
	isNewDao: false,
	isUser: false,
});

export const LanternProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const { address, isConnected } = useConnection();
	const contractAddress = process.env.NEXT_PUBLIC_VAULT_ADDRESS as Address;

	const { data: daoAddress } = useReadContract({
		address: contractAddress,
		abi: VaultPrudentGlUSDPABI,
		functionName: 'dao',
		query: { enabled: isConnected },
	});

	const { data: newDaoAddress } = useReadContract({
		address: contractAddress,
		abi: VaultPrudentGlUSDPABI,
		functionName: 'dao',
		query: { enabled: isConnected },
	});

	const isDao = isConnected && daoAddress === address;
	const isNewDao = isConnected && newDaoAddress === address;
	const isUser = isConnected;

	return (
		<LanternContext.Provider
			value={{ isConnected, address, isDao, isNewDao, isUser }}
		>
			{children}
		</LanternContext.Provider>
	);
};

export const useLantern = () => useContext(LanternContext);

