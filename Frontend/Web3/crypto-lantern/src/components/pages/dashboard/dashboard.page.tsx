'use client';

import { useReadContracts, useChainId } from 'wagmi';
import { Address, formatUnits } from 'viem';
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
	ChessRook,
} from 'lucide-react';
import { publicClient as client } from '@/lib/client';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import DashboarCard from '@/components/ui/cards/DashboardCard';
import { useTranslation } from 'react-i18next';
import { StrategyType } from '@/data/types/Strategy';
import { useCurrency } from '@/hooks/useCurrency';

export default function VaultDashboard() {
	const { vaultPrudentGlUSDPAddress, isConnected } = useLantern();
	const chainId = useChainId();
	const { theme } = useTheme();
	const { t } = useTranslation();
	const { formatCurrency } = useCurrency();

	const [bufferStats, setBufferStats] = useState({ amount: 0, bips: 0 });
	const [isLoadingStats, setIsLoadingStats] = useState(true);
	const [strategies, setStrategies] = useState([['', 0n, 0n]]);

	const fetchBufferStats = async () => {
		setIsLoadingStats(true);
		console.log('LOAD DATA');
		try {
			if (!chainId || !vaultPrudentGlUSDPAddress) return;

			const tvl = (await client(chainId).readContract({
				address: vaultPrudentGlUSDPAddress,
				abi: VaultPrudentGlUSDPABI,
				functionName: 'totalAssets',
			})) as bigint;

			const currentBufferAmount =
				((await client(chainId).readContract({
					address: vaultPrudentGlUSDPAddress,
					abi: VaultPrudentGlUSDPABI,
					functionName: 'getBufferTotalAssets',
				})) as bigint) ?? 0n;

			const actualBips =
				tvl > 0n ? Number((currentBufferAmount * 10000n) / tvl) : 0;

			setBufferStats({
				amount: Number(currentBufferAmount) / 1e6, // Conversion USDC
				bips: actualBips,
			});

			const strategies: StrategyType[] = [];
			let index = 0;
			console.log('before while');
			while (strategies.length < 10) {
				try {
					const strategyResult: [Address, bigint, bigint] =
						(await client(chainId).readContract({
							address: vaultPrudentGlUSDPAddress,
							abi: VaultPrudentGlUSDPABI,
							functionName: 'strategies',
							args: [index],
						})) as [Address, bigint, bigint];

					strategies.push(strategyResult);
					index++;
				} catch (error) {
					break;
				}
			}

			setStrategies(strategies);
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
	if (isError || !data) return <div>{t('dashboard.errorFetching')}</div>;

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
		if (!ts.result) return t('dashboard.never');
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
						{t('dashboard.notSet')}
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

	const renderStrategies = () => {
		return strategies.map((strategy) => {
			return (
				<div
					key={strategy[0]}
					className='flex flex-col gap-2'
				>
					<div className='flex flex-col text-sm'>
						<span className='text-muted-foreground'>
							{t('dashboard.strategyAddress')}
						</span>
						<a
							href={`https://sepolia.etherscan.io/tx/${strategy[0].toString()}`}
							target='_blank'
							rel='noopener noreferrer'
							className='text-gray-400 hover:text-white transition-colors underline '
						>{`${strategy[0].toString().slice(0, 6)}...${strategy[0].toString().slice(-4)}`}</a>
					</div>
					<div className='flex justify-between text-sm'>
						<span className='text-muted-foreground'>
							{t('dashboard.repartition')}
						</span>
						<span>{strategy[1]}</span>
					</div>
					<div className='flex justify-between text-sm'>
						<span className='text-muted-foreground'>
							{t('dashboard.deltaBIPS')}
						</span>
						<span>{strategy[2]}</span>
					</div>
				</div>
			);
		});
	};

	return (
		<>
			<div className='max-w-4xl mx-auto py-10 px-4 space-y-0 grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
				<DashboarCard
					title={t('dashboard.totalAssets')}
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
					title={t('dashboard.totalSupply')}
					icon={<Coins className='h-4 w-4 text-blue-500' />}
					span={1}
					content={
						<div className='text-2xl font-bold'>
							{totalSupply.result
								? formatCurrency(
										formatUnits(
											totalSupply.result as bigint,
											6,
										),
									)
								: formatCurrency(0)}{' '}
							glUSD-P
						</div>
					}
					theme={theme}
				/>

				<DashboarCard
					title={t('dashboard.sharePrice')}
					icon={<ArrowUpRight className='h-4 w-4 text-green-500' />}
					span={1}
					content={
						<div className='text-2xl font-bold'>
							{pricePerShare.result
								? formatCurrency(
										formatUnits(
											pricePerShare.result as bigint,
											6,
										),
									)
								: formatCurrency(1)}{' '}
							USDC
						</div>
					}
					theme={theme}
				/>

				<DashboarCard
					title={t('dashboard.bufferTitle')}
					icon={<Percent className='h-4 w-4 text-amber-500' />}
					span={1}
					content={
						<div className='text-2xl font-bold'>
							{isLoadingStats ? (
								<Skeleton />
							) : (
								<div className='text-2xl font-bold'>
									{formatCurrency(
										Math.ceil(bufferStats.bips) / 100,
									)}
									%
								</div>
							)}
							{isLoadingStats ? (
								<Skeleton />
							) : (
								<div className='text-2xl font-bold'>
									{formatCurrency(bufferStats.amount)} USDC
								</div>
							)}
							<p className='text-xs text-muted-foreground'>
								{t('dashboard.bufferSubtitle')}
							</p>
						</div>
					}
					theme={theme}
				/>

				<DashboarCard
					title={t('dashboard.currentStrategies')}
					icon={<ChessRook className='h-4 w-4 text-red-700' />}
					span={1}
					content={
						isLoadingStats ? (
							<Skeleton />
						) : (
							<>{renderStrategies()}</>
						)
					}
					theme={theme}
				/>
				<DashboarCard
					title={t('dashboard.deploymentDate')}
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
					title={t('dashboard.technicalHistory')}
					icon={<Clock className='h-4 w-4 text-navy' />}
					span={1}
					content={
						<>
							<div className='flex justify-between text-sm'>
								<span className='text-muted-foreground'>
									{t('dashboard.deployment')}
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
									{t('dashboard.lastHarvest')}
								</span>
								<span className='font-medium'>
									{lastHarvest.result
										? new Date(
												Number(lastHarvest.result) *
													1000,
											).toLocaleString()
										: t('dashboard.never')}
								</span>
							</div>
							<div className='flex justify-between text-sm'>
								<span className='text-muted-foreground'>
									{t('dashboard.securityBuffer')}
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
					title={t('dashboard.governanceAndSecurity')}
					icon={<Shield className='h-4 w-4 text-navy' />}
					span={2}
					content={
						<>
							<div className='bg-gray-100 dark:bg-gray-900 p-3 rounded-lg'>
								<p className='text-[10px] uppercase font-bold text-gray-400 mb-2'>
									{t('dashboard.ownerAndDao')}
								</p>
								{renderAddress(t('dashboard.currentDao'), dao)}
								{renderAddress(
									t('dashboard.newDaoPending'),
									newDao,
								)}
							</div>

							<div className='bg-gray-100 dark:bg-gray-900 p-3 rounded-lg'>
								<p className='text-[10px] uppercase font-bold text-gray-400 mb-2'>
									{t('dashboard.technicalManagement')}
								</p>
								{renderAddress(
									t('dashboard.currentTeam'),
									team,
								)}
								{renderAddress(
									t('dashboard.newTeamPending'),
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
