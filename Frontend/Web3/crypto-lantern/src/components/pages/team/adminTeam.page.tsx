'use client';

import { useEffect, useState } from 'react';
import { useWriteContract, usePublicClient, useChainId } from 'wagmi';
import { Address, isAddress, parseAbiItem } from 'viem';
import { useLantern } from '@/context/LanternContext';
import VaultPrudentGlUSDPABI from '@/context/VaultPrudentGlUSDP.json';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
	Loader2,
	ShieldAlert,
	Wheat,
	UserCog,
	CheckCircle2,
} from 'lucide-react';
import { publicClient as client } from '@/lib/client';
import { NETWORK_CONFIG } from '@/config/NetworkConfig';
import {
	HarvestMovementEvent,
	RebalanceMovementEvent,
} from '@/data/types/MovementEvent';
import { HarvestEventLogsCard } from '@/components/shared/cards/eventLogs/HarvestLogsCard';
import { RebalanceEventLogsCard } from '@/components/shared/cards/eventLogs/RebalanceLogsCard';
import { t } from 'i18next';

export default function AdminTeam() {
	const { isTeam, isNewTeam, vaultPrudentGlUSDPAddress } = useLantern();
	const { writeContractAsync } = useWriteContract();
	const publicClient = usePublicClient();
	const chainId = useChainId();

	const [newAddressInput, setNewAddressInput] = useState('');
	const [isExecuting, setIsExecuting] = useState(false);
	const [harvestEvents, setHarvestEvents] = useState<HarvestMovementEvent[]>(
		[],
	);
	const [rebalanceEvents, setRebalanceEvents] = useState<
		RebalanceMovementEvent[]
	>([]);
	const [loadingHarvestEvents, setLoadingHarvestEvents] = useState(false);
	const [loadingRebalanceEvents, setLoadingRebalanceEvents] = useState(false);

	const fromBlock = NETWORK_CONFIG[chainId]?.fromBlock || 0n;

	const getHarvestEvents = async () => {
		if (!chainId || !vaultPrudentGlUSDPAddress) return;
		setLoadingHarvestEvents(true);

		try {
			const harvestLogs = await client(chainId).getLogs({
				address: vaultPrudentGlUSDPAddress,
				event: parseAbiItem(
					'event Harvest(uint256 yield, uint256 fees, uint256 sharesToMint, uint256 totalAssets)',
				),
				fromBlock,
				toBlock: 'latest',
			});

			const harvestEvents: HarvestMovementEvent[] = harvestLogs.map(
				(log) => {
					return {
						yield: log.args.yield ?? 0n,
						fees: log.args.fees ?? 0n,
						sharesToMint: log.args.sharesToMint ?? 0n,
						totalAssets: log.args.totalAssets ?? 0n,
						blockNumber: Number(log.blockNumber),
						transactionHash: log.transactionHash,
					};
				},
			);
			setHarvestEvents(
				harvestEvents.sort((a, b) => b.blockNumber - a.blockNumber),
			);
		} catch (error) {
			console.error(error);
			setHarvestEvents([]);
		} finally {
			setLoadingHarvestEvents(false);
		}
	};
	const getRebalanceEvents = async () => {
		if (!chainId || !vaultPrudentGlUSDPAddress) return;
		setLoadingRebalanceEvents(true);

		try {
			const rebalanceLogs = await client(chainId).getLogs({
				address: vaultPrudentGlUSDPAddress,
				event: parseAbiItem(
					'event Rebalance(bool force, uint256 currentTotalAssets, uint256 newBuffer, uint256 divestedAmout, uint256 reinvestedAmout)',
				),
				fromBlock,
				toBlock: 'latest',
			});

			const rebalanceEvents: RebalanceMovementEvent[] = rebalanceLogs.map(
				(log) => {
					return {
						force: log.args.force ?? false,
						newBuffer: log.args.newBuffer ?? 0n, // Buffer
						currentTotalAssets: log.args.currentTotalAssets ?? 0n, // TVL
						reinvestedAmout: log.args.reinvestedAmout ?? 0n,
						blockNumber: Number(log.blockNumber),
						transactionHash: log.transactionHash,
					};
				},
			);
			setRebalanceEvents(
				rebalanceEvents.sort((a, b) => b.blockNumber - a.blockNumber),
			);
		} catch (error) {
			console.error(error);
			setRebalanceEvents([]);
		} finally {
			setLoadingRebalanceEvents(false);
		}
	};

	// --- FONCTION 1 : HARVEST ---
	const handleHarvest = async () => {
		if (!publicClient || !vaultPrudentGlUSDPAddress) return;
		setIsExecuting(true);

		try {
			toast.loading(t('adminTeam.loadingSignHarvest'), {
				id: 'admin-toast',
			});

			const hash = await writeContractAsync({
				address: vaultPrudentGlUSDPAddress,
				abi: VaultPrudentGlUSDPABI,
				functionName: 'harvest',
			});

			toast.loading(t('adminTeam.loadingHarvesting'), {
				id: 'admin-toast',
			});
			await publicClient.waitForTransactionReceipt({ hash });

			toast.success(t('adminTeam.successHarvest'), { id: 'admin-toast' });
			setTimeout(() => {
				getHarvestEvents();
				getRebalanceEvents();
			}, 10000);
		} catch (error) {
			console.error(error);
			toast.error(t('adminTeam.errorHarvest'), { id: 'admin-toast' });
		} finally {
			setIsExecuting(false);
		}
	};

	const handleSetTeamAddress = async () => {
		if (!publicClient || !vaultPrudentGlUSDPAddress) return;

		if (!isAddress(newAddressInput)) {
			toast.error(t('adminTeam.invalidAddress'));
			return;
		}

		setIsExecuting(true);
		try {
			toast.loading(t('adminTeam.loadingSignAddress'), {
				id: 'admin-toast',
			});

			const hash = await writeContractAsync({
				address: vaultPrudentGlUSDPAddress,
				abi: VaultPrudentGlUSDPABI,
				functionName: 'setTeamAddress',
				args: [newAddressInput as Address],
			});

			toast.loading(t('adminTeam.loadingValidating'), {
				id: 'admin-toast',
			});
			await publicClient.waitForTransactionReceipt({ hash });

			toast.success(t('adminTeam.successPropose'), { id: 'admin-toast' });
			setNewAddressInput('');
		} catch (error) {
			console.error(error);
			toast.error(t('adminTeam.errorPropose'), { id: 'admin-toast' });
		} finally {
			setIsExecuting(false);
		}
	};

	const handleConfirmTeamAddress = async () => {
		if (!publicClient || !vaultPrudentGlUSDPAddress) return;
		setIsExecuting(true);

		try {
			toast.loading(t('dao.loadingSign'), { id: 'admin-toast' });

			const hash = await writeContractAsync({
				address: vaultPrudentGlUSDPAddress,
				abi: VaultPrudentGlUSDPABI,
				functionName: 'confirmNewTeamAddress',
			});

			toast.loading(t('dao.loadingTransfer'), { id: 'admin-toast' });
			await publicClient.waitForTransactionReceipt({ hash });

			toast.success(t('dao.successNewTeam'), { id: 'admin-toast' });
		} catch (error) {
			console.error(error);
			toast.error(t('dao.errorConfirm'), { id: 'admin-toast' });
		} finally {
			setIsExecuting(false);
		}
	};

	useEffect(() => {
		getHarvestEvents();
		getRebalanceEvents();
	}, []);

	// --- AFFICHAGE : NON AUTORISÉ ---
	if (!isTeam && !isNewTeam) {
		return (
			<div className='flex flex-col items-center max-w-4xl mx-auto px-4 space-y-8 py-20 text-center'>
				<ShieldAlert className='h-16 w-16 text-red-500/50 mb-4' />
				<h2 className='text-2xl font-bold text-navy mb-2'>
					{t('adminTeam.accessRestricted')}
				</h2>
				<p className='text-navy/60'>{t('adminTeam.noAdminRights')}</p>
			</div>
		);
	}

	return (
		<div className='max-w-4xl mx-auto py-10 px-4 space-y-8'>
			<h1 className='text-3xl font-bold text-navy flex items-center gap-3'>
				<UserCog className='h-8 w-8 text-[#28B092]' />
				{t('adminTeam.portalTitle')}
			</h1>

			{/* PANNEAU DE LA NOUVELLE TEAM EN ATTENTE DE CONFIRMATION */}
			{isNewTeam && (
				<Card className='border-amber-200 bg-amber-50 shadow-md'>
					<CardHeader>
						<CardTitle className='text-amber-800 flex items-center gap-2'>
							<ShieldAlert className='h-5 w-5' />
							{t('adminTeam.actionRequired')}
						</CardTitle>
						<CardDescription className='text-amber-700/80'>
							{t('adminTeam.successorMessage')}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							onClick={handleConfirmTeamAddress}
							disabled={isExecuting}
							className='bg-amber-600 hover:bg-amber-700 text-white w-full sm:w-auto'
						>
							{isExecuting ? (
								<Loader2 className='mr-2 h-4 w-4 animate-spin' />
							) : (
								<CheckCircle2 className='mr-2 h-4 w-4' />
							)}
							{t('adminTeam.acceptTeamRole')}
						</Button>
					</CardContent>
				</Card>
			)}

			{/* PANNEAUX DE LA TEAM ACTUELLE */}
			{isTeam && (
				<>
					<div className='grid md:grid-cols-2 gap-6'>
						{/* CARTE HARVEST */}
						<Card className='shadow-lg border-none py-0'>
							<CardHeader className='bg-[#28B092]/10 rounded-t-lg'>
								<CardTitle className='text-[#28B092] flex items-center gap-2'>
									<Wheat className='h-5 w-5' />
									{t('adminTeam.executeHarvest')}
								</CardTitle>
							</CardHeader>
							<CardContent className='pt-6 space-y-4'>
								<p className='text-sm text-navy/70'>
									{t('adminTeam.harvestDesc')}
								</p>
								<Button
									onClick={handleHarvest}
									disabled={isExecuting}
									className='w-full bg-[#28B092] hover:bg-[#2ABFAB] text-white font-bold'
								>
									{isExecuting ? (
										<Loader2 className='mr-2 h-5 w-5 animate-spin' />
									) : null}
									{t('adminTeam.runHarvest')}
								</Button>
							</CardContent>
						</Card>

						{/* CARTE CHANGEMENT DE TEAM */}
						<Card className='shadow-lg border-none'>
							<CardHeader className='bg-navy/5 rounded-t-xl'>
								<CardTitle className='text-navy flex items-center gap-2'>
									<UserCog className='h-5 w-5' />
									{t('adminTeam.transferRights')}
								</CardTitle>
							</CardHeader>
							<CardContent className='pt-6 space-y-4'>
								<p className='text-sm text-navy/70'>
									{t('adminTeam.transferDesc')}
								</p>
								<div className='space-y-2'>
									<Input
										placeholder='0x...'
										value={newAddressInput}
										onChange={(e) =>
											setNewAddressInput(e.target.value)
										}
										disabled={isExecuting}
										className='font-mono text-sm'
									/>
									<Button
										onClick={handleSetTeamAddress}
										disabled={
											isExecuting || !newAddressInput
										}
									>
										{isExecuting ? (
											<Loader2 className='mr-2 h-5 w-5 animate-spin' />
										) : null}
										Proposer cette adresse
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>
					<HarvestEventLogsCard
						title={t('')}
						events={harvestEvents}
						loading={loadingHarvestEvents}
					/>
					<RebalanceEventLogsCard
						title={t('')}
						events={rebalanceEvents}
						loading={loadingRebalanceEvents}
					/>
				</>
			)}
		</div>
	);
}
