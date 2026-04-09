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
} from 'lucide-react';

export default function VaultDashboard() {
	const { vaultPrudentGlUSDPAddress, isConnected } = useLantern();
	const chainId = useChainId();

	// Regroupement des appels pour la performance
	const { data, isLoading, isError } = useReadContracts({
		contracts: [
			{
				address: vaultPrudentGlUSDPAddress,
				abi: VaultPrudentGlUSDPABI as Abi,
				functionName: 'totalAssets',
			},
			{
				address: vaultPrudentGlUSDPAddress,
				abi: VaultPrudentGlUSDPABI as Abi,
				functionName: 'totalSupply',
			},
			{
				address: vaultPrudentGlUSDPAddress,
				abi: VaultPrudentGlUSDPABI as Abi,
				functionName: 'bufferBIPS',
			},
			{
				address: vaultPrudentGlUSDPAddress,
				abi: VaultPrudentGlUSDPABI as Abi,
				functionName: 'deploymentTimestamp',
			},
			{
				address: vaultPrudentGlUSDPAddress,
				abi: VaultPrudentGlUSDPABI as Abi,
				functionName: 'lastHarvestTimestamp',
			},
			{
				address: vaultPrudentGlUSDPAddress,
				abi: VaultPrudentGlUSDPABI as Abi,
				functionName: 'convertToAssets',
				args: [BigInt(10 ** 6)], // Prix pour 1 part (avec 6 décimales)
			},
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
	] = data;

	// Helper pour formater les dates
	const formatDate = (ts: any) => {
		if (!ts.result) return 'Jamais';
		return new Date(Number(ts.result) * 1000).toLocaleString();
	};

	return (
		<div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
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
							: '0'}
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
		</div>
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
