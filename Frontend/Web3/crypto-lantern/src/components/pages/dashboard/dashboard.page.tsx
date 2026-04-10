'use client';

import { useReadContracts, useChainId } from 'wagmi';
import { formatUnits, formatEther, type Abi } from 'viem';
import { useLantern } from '@/context/LanternContext';
import VaultPrudentGlUSDPABI from '@/context/VaultPrudentGlUSDP.json';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton'; // Si tu as ce composant shadcn
import {
	Activity,
	ShieldCheck,
	Clock,
	Coins,
	Landmark,
	Percent,
	ArrowUpRight,
	Shield,
} from 'lucide-react';

export default function VaultDashboard() {
	const { vaultPrudentGlUSDPAddress, isConnected } = useLantern();
	const chainId = useChainId();

	const baseConfig = {
		address: vaultPrudentGlUSDPAddress,
		abi: VaultPrudentGlUSDPABI,
	};
	// Regroupement des appels pour la performance
	const { data, isLoading, isError } = useReadContracts({
		contracts: [
			{ ...baseConfig, functionName: 'totalAssets' },
			{ ...baseConfig, functionName: 'totalSupply' },
			{ ...baseConfig, functionName: 'bufferBIPS' },
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
			{ ...baseConfig, functionName: 'owner' },
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
		bufferBIPS,
		deploymentDate,
		lastHarvest,
		pricePerShare,
		dao,
		team,
		newDao,
		newTeam,
		owner,
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
				{/* --- SECTION METRIQUES FINANCIERES --- */}
				<Card className='border-none shadow-md bg-white'>
					<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
						<CardTitle className='text-sm font-medium'>
							Total Assets (AUM)
						</CardTitle>
						<Landmark className='h-4 w-4 text-[#28B092]' />
					</CardHeader>
					<CardContent>
						<div className='text-2xl font-bold'>
							{totalAssets.result
								? formatUnits(totalAssets.result as bigint, 6)
								: '0'}{' '}
							USDC
						</div>
						<p className='text-xs text-muted-foreground'>
							Total des fonds sous gestion
						</p>
					</CardContent>
				</Card>

				<Card className='border-none shadow-md bg-white'>
					<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
						<CardTitle className='text-sm font-medium'>
							Total Supply
						</CardTitle>
						<Coins className='h-4 w-4 text-blue-500' />
					</CardHeader>
					<CardContent>
						<div className='text-2xl font-bold'>
							{totalSupply.result
								? formatUnits(totalSupply.result as bigint, 6)
								: '0'}{' '}
							glUSD-P
						</div>
						<p className='text-xs text-muted-foreground'>
							Parts totales émises
						</p>
					</CardContent>
				</Card>

				<Card className='border-none shadow-md bg-white'>
					<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
						<CardTitle className='text-sm font-medium'>
							Prix de la part
						</CardTitle>
						<ArrowUpRight className='h-4 w-4 text-green-500' />
					</CardHeader>
					<CardContent>
						<div className='text-2xl font-bold'>
							{pricePerShare.result
								? formatUnits(pricePerShare.result as bigint, 6)
								: '1.00'}{' '}
							USDC
						</div>
						<p className='text-xs text-muted-foreground'>
							Valeur actuelle de 1 glUSD-P
						</p>
					</CardContent>
				</Card>

				{/* --- SECTION CONFIGURATION & ETAT --- */}
				<Card className='border-none shadow-md bg-white'>
					<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
						<CardTitle className='text-sm font-medium'>
							Liquidité de sécurité (Buffer)
						</CardTitle>
						<Percent className='h-4 w-4 text-amber-500' />
					</CardHeader>
					<CardContent>
						<div className='text-2xl font-bold'>
							{bufferBIPS.result
								? Number(bufferBIPS.result) / 100
								: '100'}
							%
						</div>
						<p className='text-xs text-muted-foreground'>
							Pourcentage conservé hors stratégies
						</p>
					</CardContent>
				</Card>

				<Card className='border-none shadow-md bg-white'>
					<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
						<CardTitle className='text-sm font-medium'>
							Dernier Harvest
						</CardTitle>
						<Clock className='h-4 w-4 text-purple-500' />
					</CardHeader>
					<CardContent>
						<div className='text-sm font-bold'>
							{formatDate(lastHarvest)}
						</div>
						<p className='text-xs text-muted-foreground'>
							Dernière récolte de rendements
						</p>
					</CardContent>
				</Card>

				<Card className='border-none shadow-md bg-white'>
					<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
						<CardTitle className='text-sm font-medium'>
							Date de déploiement
						</CardTitle>
						<ShieldCheck className='h-4 w-4 text-navy' />
					</CardHeader>
					<CardContent>
						<div className='text-sm font-bold'>
							{formatDate(deploymentDate)}
						</div>
						<p className='text-xs text-muted-foreground'>
							Initialisation du contrat
						</p>
					</CardContent>
				</Card>
				{/* SECTION GOUVERNANCE ET ROLES */}

				<Card className='border-none shadow-md'>
					<CardHeader>
						<CardTitle className='text-sm flex items-center gap-2'>
							<Clock className='h-4 w-4 text-navy' />
							Historique Technique
						</CardTitle>
					</CardHeader>
					<CardContent className='space-y-2'>
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
											Number(lastHarvest.result) * 1000,
										).toLocaleString()
									: 'Jamais'}
							</span>
						</div>
						<div className='flex justify-between text-sm'>
							<span className='text-muted-foreground'>
								Buffer de sécurité :
							</span>
							<span className='font-medium'>
								{(Number(bufferBIPS.result) || 0) / 100}%
							</span>
						</div>
					</CardContent>
				</Card>
				<Card className='border-none shadow-md md:col-span-2'>
					<CardHeader>
						<CardTitle className='text-sm flex items-center gap-2'>
							<Shield className='h-4 w-4 text-navy' />
							Gouvernance & Sécurité
						</CardTitle>
					</CardHeader>
					<CardContent className='space-y-4'>
						<div className='bg-gray-50 p-3 rounded-lg'>
							<p className='text-[10px] uppercase font-bold text-gray-400 mb-2'>
								Propriétaire & DAO
							</p>
							{renderAddress('Contract Owner', owner)}
							{renderAddress('DAO Actuelle', dao)}
							{renderAddress('Nouvelle DAO (En attente)', newDao)}
						</div>

						<div className='bg-gray-50 p-3 rounded-lg'>
							<p className='text-[10px] uppercase font-bold text-gray-400 mb-2'>
								Gestion Technique (Team)
							</p>
							{renderAddress('Team Actuelle', team)}
							{renderAddress(
								'Nouvelle Team (En attente)',
								newTeam,
							)}
						</div>
					</CardContent>
				</Card>
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
