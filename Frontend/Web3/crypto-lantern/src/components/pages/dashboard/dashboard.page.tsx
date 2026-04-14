'use client';

import { useReadContracts, useChainId } from 'wagmi';
import { formatUnits } from 'viem';
import { useLantern } from '@/context/LanternContext';
import VaultPrudentGlUSDPABI from '@/context/VaultPrudentGlUSDP.json';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton'; // Si tu as ce composant shadcn
import {
	ShieldCheck,
	Clock,
	Coins,
	Landmark,
	Percent,
	ArrowUpRight,
	Shield,
} from 'lucide-react';
import { publicClient as client } from '@/lib/client';
import { parseAbiItem } from 'viem';
import { NETWORK_CONFIG } from '@/config/NetworkConfig';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import DashboarCard from '@/components/ui/cards/DashboardCard';

export default function VaultDashboard() {
	const { vaultPrudentGlUSDPAddress, isConnected } = useLantern();
	const chainId = useChainId();
	const { theme } = useTheme();

	const [bufferStats, setBufferStats] = useState({ amount: 0, bips: 0 });
	const [isLoadingStats, setIsLoadingStats] = useState(true);
	const fetchBufferStats = async () => {
		setIsLoadingStats(true);
		try {
			if (!chainId || !vaultPrudentGlUSDPAddress) return;

			const fromBlock = NETWORK_CONFIG[chainId]?.fromBlock || 0n;

			// Récupération des logs Rebalance
			const rebalanceLogs = await client(chainId).getLogs({
				address: vaultPrudentGlUSDPAddress,
				event: parseAbiItem(
					'event Rebalance(bool force, uint256 currentTotalAssets, uint256 newBuffer, uint256 divestedAmout, uint256 reinvestedAmout)',
				),
				fromBlock,
				toBlock: 'latest',
			});

			const tvl = (await client(chainId).readContract({
				address: vaultPrudentGlUSDPAddress,
				abi: VaultPrudentGlUSDPABI,
				functionName: 'totalAssets',
			})) as bigint;

			if (rebalanceLogs.length > 0) {
				const lastBuffer = rebalanceLogs[rebalanceLogs.length - 1].args
					.newBuffer as bigint;
				const actualBips =
					tvl > 0n ? Number((lastBuffer * 10000n) / tvl) : 0;

				setBufferStats({
					amount: Number(lastBuffer) / 1e6, // Conversion USDC
					bips: actualBips,
				});
			}
		} catch (error) {
			console.error('Erreur stats:', error);
		} finally {
			setIsLoadingStats(false);
		}
	};

	useEffect(() => {
		fetchBufferStats();
	}, [chainId, vaultPrudentGlUSDPAddress]);

	const baseConfig = {
		address: vaultPrudentGlUSDPAddress,
		abi: VaultPrudentGlUSDPABI,
	};
	// Regroupement des appels pour la performance
	const { data, isLoading, isError } = useReadContracts({
		contracts: [
			{ ...baseConfig, functionName: 'totalAssets' },
			{ ...baseConfig, functionName: 'totalSupply' },
			{ ...baseConfig, functionName: 'deploymentTimestamp' },
			{ ...baseConfig, functionName: 'lastHarvestTimestamp' },
			{
				...baseConfig,
				functionName: 'convertToAssets',
				args: [BigInt(10 ** 6)], // Prix pour 1 part (avec 6 décimales)
			},
			{ ...baseConfig, functionName: 'daoAddress' },
			{ ...baseConfig, functionName: 'teamAddress' },
			{ ...baseConfig, functionName: 'newDaoAddress' },
			{ ...baseConfig, functionName: 'newTeamAddress' },
		],
		query: {
			enabled: isConnected && !!vaultPrudentGlUSDPAddress,
			refetchInterval: 30000, // Rafraîchir toutes les 30 secondes
		},
	});

	if (isLoading) return <DashboardSkeleton />;
	if (isError || !data)
		return <div>Erreur lors de la récupération des données du Vault.</div>;

	// Extraction des résultats (dans l'ordre des appels ci-dessus)
	const [
		totalAssets,
		totalSupply,
		deploymentDate,
		lastHarvest,
		pricePerShare,
		dao,
		team,
		newDao,
		newTeam,
	] = data;

	// Helper pour formater les dates
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const formatDate = (ts: any) => {
		if (!ts.result) return 'Jamais';
		return new Date(Number(ts.result) * 1000).toLocaleString();
	};

	const renderAddress = (
		label: string,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		addressResult: any,
	): React.ReactNode => {
		const address = addressResult.result as string;
		if (
			!address ||
			address === '0x0000000000000000000000000000000000000000'
		) {
			return (
				<div className='flex justify-between items-center py-1'>
					<span className='text-xs text-muted-foreground'>
						{label}
					</span>{' '}
					<span className='text-gray-400 italic'>
						Non définie
					</span>{' '}
				</div>
			);
		}
		return (
			<div className='flex justify-between items-center py-1'>
				<span className='text-xs text-muted-foreground'>{label}</span>
				<a
					href={`https://sepolia.etherscan.io/address/${address}`}
					target='_blank'
					className='text-xs font-mono text-blue-600 hover:underline'
				>
					{address}
				</a>
			</div>
		);
	};

	return (
		<>
			<div className='max-w-4xl mx-auto py-10 px-4 space-y-0 grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
				<DashboarCard
					title='Total Assets (AUM)'
					icon={<Landmark className='h-4 w-4 text-[#28B092]' />}
					span={1}
					content={
						<div className='text-2xl font-bold'>
							{totalAssets.result
								? formatUnits(totalAssets.result as bigint, 6)
								: '0'}{' '}
							USDC
						</div>
					}
					theme={theme}
				/>

				<DashboarCard
					title='Total Supply'
					icon={<Coins className='h-4 w-4 text-blue-500' />}
					span={1}
					content={
						<div className='text-2xl font-bold'>
							{totalSupply.result
								? formatUnits(totalSupply.result as bigint, 6)
								: '0'}{' '}
							glUSD-P
						</div>
					}
					theme={theme}
				/>

				<DashboarCard
					title='Prix de la part'
					icon={<ArrowUpRight className='h-4 w-4 text-green-500' />}
					span={1}
					content={
						<div className='text-2xl font-bold'>
							{pricePerShare.result
								? formatUnits(pricePerShare.result as bigint, 6)
								: '1.00'}{' '}
							USDC
						</div>
					}
					theme={theme}
				/>

				<DashboarCard
					title='Liquidité de sécurité (Buffer)'
					icon={<Percent className='h-4 w-4 text-amber-500' />}
					span={1}
					content={
						<div className='text-2xl font-bold'>
							{isLoadingStats ? (
								<Skeleton />
							) : (
								<div className='text-2xl font-bold'>
									{Math.ceil(bufferStats.bips) / 100}%
								</div>
							)}
							{isLoadingStats ? (
								<Skeleton />
							) : (
								<div className='text-2xl font-bold'>
									{bufferStats.amount} USDC
								</div>
							)}
							<p className='text-xs text-muted-foreground'>
								Pourcentage conservé hors stratégies
							</p>
						</div>
					}
					theme={theme}
				/>

				<DashboarCard
					title='Date de déploiement'
					icon={<ShieldCheck className='h-4 w-4 text-navy' />}
					span={1}
					content={
						<div className='text-2xl font-bold'>
							{formatDate(deploymentDate)}
						</div>
					}
					theme={theme}
				/>

				<DashboarCard
					title='Historique Technique'
					icon={<Clock className='h-4 w-4 text-navy' />}
					span={1}
					content={
						<>
							<div className='flex justify-between text-sm'>
								<span className='text-muted-foreground'>
									Déploiement :
								</span>
								<span className='font-medium'>
									{deploymentDate.result
										? new Date(
												Number(deploymentDate.result) *
													1000,
											).toLocaleDateString()
										: '---'}
								</span>
							</div>
							<div className='flex justify-between text-sm'>
								<span className='text-muted-foreground'>
									Dernier Harvest :
								</span>
								<span className='font-medium'>
									{lastHarvest.result
										? new Date(
												Number(lastHarvest.result) *
													1000,
											).toLocaleString()
										: 'Jamais'}
								</span>
							</div>
							<div className='flex justify-between text-sm'>
								<span className='text-muted-foreground'>
									Buffer de sécurité :
								</span>
								{isLoadingStats ? (
									<Skeleton />
								) : (
									<span className='font-medium'>
										{Math.ceil(bufferStats.bips) / 100}%
									</span>
								)}
							</div>
						</>
					}
					theme={theme}
				/>

				<DashboarCard
					title='Gouvernance & Sécurité'
					icon={<Shield className='h-4 w-4 text-navy' />}
					span={2}
					content={
						<>
							<div className='bg-gray-100 dark:bg-gray-900 p-3 rounded-lg'>
								<p className='text-[10px] uppercase font-bold text-gray-400 mb-2'>
									Propriétaire & DAO
								</p>
								{renderAddress('DAO Actuelle', dao)}
								{renderAddress(
									'Nouvelle DAO (En attente)',
									newDao,
								)}
							</div>

							<div className='bg-gray-100 dark:bg-gray-900 p-3 rounded-lg'>
								<p className='text-[10px] uppercase font-bold text-gray-400 mb-2'>
									Gestion Technique (Team)
								</p>
								{renderAddress('Team Actuelle', team)}
								{renderAddress(
									'Nouvelle Team (En attente)',
									newTeam,
								)}
							</div>
						</>
					}
					theme={theme}
				/>
			</div>
		</>
	);
}

function DashboardSkeleton() {
	return (
		<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
			{[1, 2, 3, 4, 5, 6].map((i) => (
				<Card
					key={i}
					className='h-32 shadow-sm animate-pulse bg-gray-100'
				/>
			))}
		</div>
	);
}
