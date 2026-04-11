'use client';

import { useChainId, useSwitchChain } from 'wagmi';
import { sepolia, hardhat } from 'wagmi/chains';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Monitor, Globe } from 'lucide-react';
import { useState, useEffect } from 'react';

export function NetworkDevSwitch() {
	const chainId = useChainId();
	const { switchChain, isPending } = useSwitchChain();

	// État local pour gérer l'affichage du switch sans attendre le lag du wallet
	const [isSepolia, setIsSepolia] = useState(chainId === sepolia.id);

	// Synchronisation si le changement vient du wallet directement
	useEffect(() => {
		setIsSepolia(chainId === sepolia.id);
	}, [chainId]);

	const handleNetworkChange = (checked: boolean) => {
		const targetId = checked ? hardhat.id : sepolia.id;
		setIsSepolia(!checked);
		switchChain({ chainId: targetId });
	};

	if (!(chainId === 11155111 || chainId === 31337)) {
		return null;
	}

	return (
		<div className='flex items-center space-x-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700  text-gray-700 dark:text-gray-300 p-2 rounded-full border border-gray/50 px-4'>
			<div className='flex items-center gap-2'>
				{isPending ? (
					<Loader2 className='h-4 w-4 animate-spin text-yellow-400' />
				) : isSepolia ? (
					<Globe className='h-4 w-4 text-blue-400' />
				) : (
					<Monitor className='h-4 w-4 text-green-400' />
				)}
				<Label
					htmlFor='network-mode'
					className='text-xs font-medium cursor-pointer'
				>
					{isSepolia ? 'Sepolia' : 'Hardhat'}
				</Label>
			</div>

			<Switch
				id='network-mode'
				checked={!isSepolia}
				onCheckedChange={handleNetworkChange}
				disabled={isPending}
			/>
		</div>
	);
}
