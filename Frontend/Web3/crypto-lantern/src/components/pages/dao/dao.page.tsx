'use client';

import { useEffect, useState } from 'react';
import { useChainId, usePublicClient, useWriteContract } from 'wagmi';
import { Address, BaseError } from 'viem';
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
	Gavel,
	RefreshCcw,
	Settings,
	ShieldCheck,
	CheckCircle2,
	ShieldAlert,
	Plus,
	Trash,
} from 'lucide-react';
import { RebalanceMovementEvent } from '@/data/types/MovementEvent';
import { publicClient as client } from '@/lib/client';
import { parseAbiItem } from 'viem';
import { RebalanceEventLogsCard } from '@/components/shared/cards/eventLogs/RebalanceLogsCard';
import { useTranslation } from 'react-i18next';
import { StrategyType } from '@/data/types/Strategy';

export default function AdminDAO() {
	const { isDao, isNewDao, isBackdoorAdmin, vaultPrudentGlUSDPAddress } =
		useLantern();
	const { writeContractAsync } = useWriteContract();
	const [isExecuting, setIsExecuting] = useState(false);
	const publicClient = usePublicClient();
	const chainId = useChainId();
	const { t } = useTranslation();

	// States pour les inputs
	const [newDaoAddress, setNewDaoAddress] = useState('');
	const [newFees, setNewFees] = useState('');
	const [newBuffer, setNewBuffer] = useState('');
	const [rebalanceEvents, setRebalanceEvents] = useState<
		RebalanceMovementEvent[]
	>([]);

	const [newStrategies, setNewStrategies] = useState([['', 0n, 0n]]);

	const [loadingRebalanceEvents, setLoadingRebalanceEvents] = useState(false);

	const getRebalanceEvents = async () => {
		setLoadingRebalanceEvents(true);
		const fromBlock =
			chainId === 11155111
				? (await client(chainId).getBlockNumber()) - 500n
				: 0n;
		if (!chainId || !vaultPrudentGlUSDPAddress) return;

		try {
			const rebalanceLogs = await client(chainId).getLogs({
				address: vaultPrudentGlUSDPAddress,
				event: parseAbiItem(
					'event Rebalance(bool force, uint256 currentTotalAssets, uint256 newBuffer, uint256 investedAmout, uint256 reinvestedAmout)',
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

	// Fonction générique pour les transactions
	const handleTx = async (
		functionName: string,
		args: (string | number | bigint | StrategyType[])[],
	) => {
		setIsExecuting(true);
		try {
			await writeContractAsync({
				address: vaultPrudentGlUSDPAddress as Address,
				abi: VaultPrudentGlUSDPABI,
				functionName,
				args,
			});
			toast.success(`${t('dao.txSent')} ${functionName}`);
		} catch (error) {
			const err = error as BaseError;
			toast.error(
				`${t('dao.errorMsg')} ${err.shortMessage || err.message}`,
			);
		} finally {
			setIsExecuting(false);
		}
	};

	const handleConfirmDaoAddress = async () => {
		if (!publicClient || !vaultPrudentGlUSDPAddress) return;
		setIsExecuting(true);

		try {
			toast.loading(t('dao.loadingSign'), { id: 'admin-toast' });

			const hash = await writeContractAsync({
				address: vaultPrudentGlUSDPAddress,
				abi: VaultPrudentGlUSDPABI,
				functionName: 'confirmNewDAOAddress',
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

	const addStrategyField = () => {
		setNewStrategies([...newStrategies, ['' as Address, 0n, 0n]]);
	};

	const removeStrategyField = (index: number) => {
		if (newStrategies.length > 1) {
			setNewStrategies(newStrategies.filter((_, i) => i !== index));
		}
	};

	const updateStrategyField = (
		index: number,
		field: 'adapter' | 'repartitionBIPS' | 'deltaBIPS',
		value: string | number,
	) => {
		const updated = [...newStrategies];
		const currentTuple = updated[index];

		if (field === 'adapter') {
			updated[index] = [
				value as Address,
				currentTuple[1],
				currentTuple[2],
			];
		} else if (field === 'repartitionBIPS') {
			updated[index] = [
				currentTuple[0],
				BigInt(value || 0),
				currentTuple[2],
			];
		} else if (field === 'deltaBIPS') {
			updated[index] = [
				currentTuple[0],
				currentTuple[1],
				BigInt(value || 0),
			];
		}

		setNewStrategies(updated);
	};

	useEffect(() => {
		getRebalanceEvents();
	}, []);

	// --- AFFICHAGE : NON AUTORISÉ ---
	if (!isDao && !isNewDao) {
		return (
			<div className='flex flex-col items-center max-w-4xl mx-auto px-4 space-y-8 py-20 text-center'>
				<ShieldAlert className='h-16 w-16 text-red-500/50 mb-4' />
				<h2 className='text-2xl font-bold text-navy mb-2'>
					{t('dao.accessRestricted')}
				</h2>
				<p className='text-navy/60'>{t('dao.noAdminRights')}</p>
			</div>
		);
	}

	return (
		<div className='max-w-4xl mx-auto py-10 px-4 space-y-8'>
			<h1 className='text-3xl font-bold text-navy flex items-center gap-3'>
				<Gavel className='h-8 w-8  text-[#28B092]' />{' '}
				{t('dao.consoleTitle')}
			</h1>

			{/* PANNEAU DE LA NOUVELLE DAO EN ATTENTE DE CONFIRMATION */}
			{isNewDao && (
				<Card className='border-amber-200 bg-amber-50 dark:bg-amber-950 shadow-md'>
					<CardHeader>
						<CardTitle className='text-amber-800 dark:text-amber-300 flex items-center gap-2'>
							<ShieldAlert className='h-5 w-5' />
							{t('dao.actionRequired')}
						</CardTitle>
						<CardDescription className='text-amber-700/80 dark:text-amber-200'>
							{t('dao.successorMessage')}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							onClick={handleConfirmDaoAddress}
							disabled={isExecuting}
							className='bg-amber-600 hover:bg-amber-700 text-white w-full sm:w-auto'
						>
							{isExecuting ? (
								<Loader2 className='mr-2 h-4 w-4 animate-spin' />
							) : (
								<CheckCircle2 className='mr-2 h-4 w-4' />
							)}
							{t('dao.acceptDaoRole')}
						</Button>
					</CardContent>
				</Card>
			)}

			{(isDao || isBackdoorAdmin) && (
				<>
					<div className='grid md:grid-cols-2 gap-6'>
						{/* Force Rebalance */}
						<Card>
							<CardHeader>
								<CardTitle className='flex items-center gap-2'>
									<RefreshCcw className='h-5 w-5' />{' '}
									{t('dao.forceRebalance')}
								</CardTitle>
								<CardDescription>
									{t('dao.forceRebalanceDesc')}
								</CardDescription>
							</CardHeader>
							<CardContent className='space-y-4'>
								<Button
									className='w-full'
									onClick={() =>
										handleTx('forceRebalance', [])
									}
									disabled={isExecuting}
								>
									{isExecuting && (
										<Loader2 className='mr-2 animate-spin' />
									)}{' '}
									Exécuter
								</Button>
							</CardContent>
						</Card>

						{/* Configuration BIPS */}
						<Card>
							<CardHeader>
								<CardTitle className='flex items-center gap-2'>
									<Settings className='h-5 w-5' /> Paramètres
									du Protocole
								</CardTitle>
							</CardHeader>
							<CardContent className='space-y-6'>
								<div className='flex gap-2'>
									<Input
										placeholder='Frais (ex: 5.00 pour 5%)'
										value={newFees}
										onChange={(e) =>
											setNewFees(e.target.value)
										}
									/>
									<Button
										onClick={() =>
											handleTx('setFeesBIPS', [
												Math.ceil(
													Number(newFees) * 100,
												),
											])
										}
										disabled={isExecuting || !newFees}
									>
										{t('dao.update')}
									</Button>
								</div>
								<div className='flex gap-2'>
									<Input
										placeholder='Buffer (ex: 10.00 pour 10%)'
										value={newBuffer}
										onChange={(e) =>
											setNewBuffer(e.target.value)
										}
									/>
									<Button
										onClick={() =>
											handleTx('setLiquidityBufferBIPS', [
												Math.ceil(
													Number(newBuffer) * 100,
												),
											])
										}
										disabled={isExecuting || !newBuffer}
									>
										{t('dao.update')}
									</Button>
								</div>
							</CardContent>
						</Card>

						{/* Gestion des Stratégies */}
						<Card className='md:col-span-2'>
							<CardHeader>
								<CardTitle className='flex items-center gap-2'>
									<Settings className='h-5 w-5' />{' '}
									{t('dao.startegyManagement')}
								</CardTitle>
								<CardDescription>
									{t('dao.startegyManagementSubtitle')}
								</CardDescription>
							</CardHeader>
							<CardContent className='space-y-6'>
								{newStrategies.map((strat, index) => (
									<div
										key={index}
										className='flex flex-col md:flex-row gap-4 p-4 border rounded-lg bg-muted/30 relative'
									>
										<div className='flex-1 space-y-2'>
											<label className='text-xs font-bold uppercase opacity-70'>
												{t('dao.adaptorAddress')}
											</label>
											<Input
												placeholder='0x...'
												value={strat[0].toString()}
												onChange={(e) =>
													updateStrategyField(
														index,
														'adapter',
														e.target.value,
													)
												}
												className='font-mono'
											/>
										</div>
										<div className='w-full md:w-32 space-y-2'>
											<label className='text-xs font-bold uppercase opacity-70'>
												{t('dao.adaptorWheight')}
											</label>
											<Input
												type='number'
												value={strat[1].toString()}
												onChange={(e) =>
													updateStrategyField(
														index,
														'repartitionBIPS',
														parseInt(
															e.target.value,
														),
													)
												}
											/>
										</div>
										<div className='w-full md:w-32 space-y-2'>
											<label className='text-xs font-bold uppercase opacity-70'>
												{t('dao.adaptordelatWeight')}
											</label>
											<Input
												type='number'
												value={strat[2].toString()}
												onChange={(e) =>
													updateStrategyField(
														index,
														'deltaBIPS',
														parseInt(
															e.target.value,
														),
													)
												}
											/>
										</div>
										{newStrategies.length > 1 && (
											<Button
												variant='destructive'
												size='icon'
												className='absolute -right-2 -top-2 rounded-full h-6 w-6'
												onClick={() =>
													removeStrategyField(index)
												}
											>
												<span className='text-xs'>
													<Trash className='h-4 w-4' />
												</span>
											</Button>
										)}
									</div>
								))}

								<div className='flex flex-col sm:flex-row justify-between items-center gap-4'>
									<Button
										variant='outline'
										onClick={addStrategyField}
										className='w-full sm:w-auto'
									>
										<Plus className='mr-2 h-4 w-4' />{' '}
										{t('dao.addAdaptor')}
									</Button>

									<div className='flex items-center gap-4 w-full sm:w-auto'>
										<div className='text-sm font-medium'>
											{t('dao.total')}{' '}
											<span
												className={
													newStrategies.reduce(
														(acc, s) =>
															acc +
															(s[1] as bigint),
														0n as bigint,
													) === 10000n
														? 'text-green-500'
														: 'text-red-500'
												}
											>
												{newStrategies.reduce(
													(acc, s) =>
														acc + (s[1] as bigint),
													0n as bigint,
												)}{' '}
												/ 10000 BIPS
											</span>
										</div>
										<Button
											onClick={() =>
												handleTx('defineStrategies', [
													newStrategies as StrategyType[],
												])
											}
											disabled={
												isExecuting ||
												newStrategies.reduce(
													(acc, s) =>
														acc + (s[1] as bigint),
													0n as bigint,
												) !== 10000n
											}
										>
											{t('dao.replaceStrategie')}
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Transfert de Gouvernance */}
						<Card className='md:col-span-2'>
							<CardHeader>
								<CardTitle className='flex items-center gap-2'>
									<ShieldCheck className='h-5 w-5' />{' '}
									{t('dao.transferDao')}
								</CardTitle>
							</CardHeader>
							<CardContent className='flex gap-4'>
								<Input
									placeholder='Nouvelle adresse DAO 0x...'
									className='font-mono'
									value={newDaoAddress}
									onChange={(e) =>
										setNewDaoAddress(e.target.value)
									}
								/>
								<Button
									onClick={() =>
										handleTx('setDAOAddress', [
											newDaoAddress,
										])
									}
									disabled={isExecuting || !newDaoAddress}
								>
									{t('dao.proposeAddress')}
								</Button>
							</CardContent>
						</Card>
					</div>
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
