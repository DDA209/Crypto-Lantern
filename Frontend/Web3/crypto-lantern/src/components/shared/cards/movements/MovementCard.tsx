'use client';

import {
	type BaseError,
	useWriteContract,
	useWaitForTransactionReceipt,
	useReadContract,
	usePublicClient,
} from 'wagmi';
import { Address, erc20Abi, parseUnits } from 'viem';
import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { toast } from 'sonner';
import {
	ArrowDownCircle,
	CheckCircle2,
	XCircle,
	Loader2,
	Clock,
	ArrowUpCircle,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import MovementCardProps from '@/data/interfaces/props/MovementCardProps';
import { useTranslation } from 'react-i18next';

// --- Types ---
export interface Network {
	id: number;
	name: string;
}

export const MovementCard = ({
	refetch,
	getEvents,
	mode,
	chainId,
	profiles,
	balance,
	globalAPY,
	userAPY,
	assetSymbol,
	shareSymbol,
	vaultAddress,
	vaultAbi,
	assetAddress,
	// onAction,
	onRequestTestTokens,
}: MovementCardProps) => {
	const [amount, setAmount] = useState<string>('');
	const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
	const [selectedAsset, setSelectedAsset] = useState<string>(assetSymbol);
	const [selectedProfile, setSelectedProfile] = useState<string>(shareSymbol);
	const [mounted, setMounted] = useState(false);
	const [showApproveModal, setShowApproveModal] = useState(false);
	const [isExecuting, setIsExecuting] = useState(false);

	const { t } = useTranslation();
	const { address } = useAccount();
	const { theme } = useTheme();
	const {
		data: hash,
		error,
		isPending,
		writeContract,
		reset,
	} = useWriteContract();
	const {
		isLoading: isConfirming,
		isSuccess: isConfirmed,
		error: errorConfirmation,
	} = useWaitForTransactionReceipt({ hash });
	const { data: allowance, refetch: refetchAllowance } = useReadContract({
		address: assetAddress,
		abi: erc20Abi,
		functionName: 'allowance',
		args: address && vaultAddress ? [address, vaultAddress] : undefined,
		query: { enabled: mode === 'deposit' && !!address && !!vaultAddress },
	});
	const amountBigInt = amount ? parseUnits(amount, 6) : 0n;

	// On a besoin d'approuver SI on est en dépôt ET que l'allowance est inférieure au montant demandé
	const needsApproval =
		mode === 'deposit' && ((allowance as bigint) || 0n) < amountBigInt;

	const txStatus = useMemo(() => {
		if (error || errorConfirmation) {
			return {
				icon: <XCircle className='h-4 w-4 shrink-0' />,
				msg:
					((error || errorConfirmation) as BaseError).shortMessage ||
					(error || errorConfirmation)!.message,
				cls: 'bg-red-500/10 text-red-400 border-red-500/20',
			};
		}
		if (isConfirmed) {
			return {
				icon: <CheckCircle2 className='h-4 w-4 shrink-0' />,
				msg: t('movementCard.transactionConfirmed'),
				cls: 'bg-green-500/10 text-green-400 border-green-500/20',
			};
		}
		if (isConfirming) {
			return {
				icon: <Loader2 className='h-4 w-4 shrink-0 animate-spin' />,
				msg: t('movementCard.transactionConfirming'),
				cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
			};
		}
		if (hash) {
			return {
				icon: <Clock className='h-4 w-4 shrink-0' />,
				msg: `Tx: ${hash.slice(0, 8)}...${hash.slice(-6)}`,
				cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
			};
		}
		return null;
	}, [hash, error, isConfirming, isConfirmed, errorConfirmation, t]);

	const activeProfile = profiles.find((p) => p.id === selectedProfile);
	const isSubmitDisabled =
		!amount || Number(amount) <= 0 || !activeProfile?.isActive;

	const publicClient = usePublicClient();
	// On récupère la version Async de writeContract
	const { writeContractAsync } = useWriteContract();

	// 1. Le clic sur le bouton principal "Déposer"
	const handleInitialClick = () => {
		if (!amount || Number(amount) <= 0 || !address || !assetAddress) return;

		if (needsApproval) {
			// S'il manque de l'allowance, on ouvre la popup
			setShowApproveModal(true);
		} else {
			// Sinon, on lance directement le dépôt
			executeTransactionSequence(false);
		}
	};

	// 2. La séquence magique (Approve -> Attente -> Deposit)
	const executeTransactionSequence = async (withApproval: boolean) => {
		if (!publicClient) return;
		setIsExecuting(true);

		try {
			// --- ÉTAPE 1 : APPROVAL (Si nécessaire) ---
			if (withApproval) {
				toast.loading(t('movementCard.transactionLoading1of2'), {
					id: 'tx-toast',
				});

				const hashApprove = await writeContractAsync({
					address: assetAddress,
					abi: erc20Abi,
					functionName: 'approve',
					args: [vaultAddress, amountBigInt],
				});

				toast.loading(t('movementCard.transactionPending1of2'), {
					id: 'tx-toast',
				});
				// On met le code en pause jusqu'à ce que le bloc soit miné
				await publicClient.waitForTransactionReceipt({
					hash: hashApprove,
				});
				setShowApproveModal(false);
			} else {
				setShowApproveModal(false);
			}

			// --- ÉTAPE 2 : DÉPÔT / RETRAIT ---
			toast.loading(
				withApproval
					? t('movementCard.transactionLoading2of2')
					: t('movementCard.transactionWaiting'),
				{ id: 'tx-toast' },
			);

			const hashAction = await writeContractAsync({
				address: vaultAddress,
				abi: vaultAbi,
				functionName: mode,
				args:
					mode === 'deposit'
						? [amountBigInt, address as Address]
						: [
								amountBigInt,
								address as Address,
								address as Address,
							],
			});

			toast.loading(t('movementCard.transactionPending'), {
				id: 'tx-toast',
			});
			await publicClient.waitForTransactionReceipt({ hash: hashAction });

			// --- SUCCÈS ---
			toast.success(t('movementCard.transactionSuccess'), {
				id: 'tx-toast',
			});
			refetch();
			refetchAllowance();
			setAmount('');
			setTimeout(() => getEvents(), 2000);
		} catch (error) {
			console.error(error);
			toast.error(t('movementCard.transactionFailed'), {
				id: 'tx-toast',
			});
		} finally {
			setIsExecuting(false);
		}
	};

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (isConfirmed) {
			if (needsApproval) {
				toast(t('movementCard.approbationSuccess'));
				refetchAllowance();
				reset();
			} else {
				toast(t('movementCard.transactionSuccess'));
				refetch();
				setTimeout(() => setAmount(''), 0);
				const timer = setTimeout(() => getEvents(), 2000);
				return () => clearTimeout(timer);
				reset();
			}
		}
	}, [
		isConfirmed,
		refetch,
		getEvents,
		needsApproval,
		refetchAllowance,
		reset,
		t,
	]);

	useEffect(
		() => {
			// if (!isCustomCursorActive) return;
			const handleMouseMove = (e: MouseEvent) => {
				setMousePos({ x: e.clientX, y: e.clientY });
			};
			window.addEventListener('mousemove', handleMouseMove);
			return () =>
				window.removeEventListener('mousemove', handleMouseMove);
		},
		// [selectedProfile]
		[],
	);

	return (
		<>
			{/* Effet Curseur Volant (Lantern) */}
			{mounted && (
				<>
					<div
						className='pointer-events-none fixed z-40 rounded-full'
						style={{
							width: '350px',
							height: '350px',
							background: `radial-gradient(circle, rgba(255, 215, 100, 0.15) 0%, transparent ${theme === 'light' ? 30 : 65}%)`,
							backdropFilter: `brightness(${theme === 'light' ? 1.01 : 1.06})`,
							left: `${mousePos.x - 168}px`,
							top: `${mousePos.y - 145}px`,
						}}
					/>
					<Image
						src={`/lantern-logo-${theme ?? 'light'}.svg`}
						width={30}
						height={30}
						alt=''
						className='pointer-events-none fixed z-30 h-8'
						style={{
							borderRadius: '50%',
							width: '30px',
							height: '30px',
							left: `${mousePos.x - 7}px`,
							top: `${mousePos.y + 17}px`,
						}}
					/>
				</>
			)}

			<Card className='bg-bg rounded-3xl border-none shadow-xl w-full max-w-md mx-auto'>
				<CardHeader
					className={`rounded-t-3xl pb-4 border-b border-navy/5 ${mode === 'deposit' ? 'bg-linear-to-r from-[#28B092]/5 to-transparent' : 'bg-linear-to-r from-navy/5 to-transparent'}`}
				>
					<CardTitle className='flex items-center gap-3'>
						<div
							className={`p-2 rounded-xl ${mode === 'deposit' ? 'bg-[#28B092]/10 text-[#28B092]' : 'bg-navy/10 text-navy'}`}
						>
							{mode === 'deposit' ? (
								<ArrowDownCircle className='h-5 w-5' />
							) : (
								<ArrowUpCircle className='h-5 w-5' />
							)}
						</div>
						<span
							suppressHydrationWarning
							className='text-sm font-bold uppercase tracking-widest text-navy/80'
						>
							{mode === 'deposit'
								? t('movementCard.depositOfFunds')
								: t('movementCard.withdrawalOfFunds')}
						</span>
					</CardTitle>
				</CardHeader>
				<CardContent className='px-6 sm:px-8 py-4 flex flex-col gap-6'>
					{txStatus && (
						<div
							className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${txStatus.cls}`}
						>
							{txStatus.icon}
							<span className='truncate'>{txStatus.msg}</span>
						</div>
					)}
					{/* Header : AppKit Button & Solde */}
					<div className='flex flex-row items-center justify-between gap-2'>
						{/* L'emplacement idéal pour le composant <appkit-button /> de Reown */}
						<div className='text-sm text-navy/40'>
							Solde :{' '}
							<span className='font-medium text-navy/60'>
								{balance}{' '}
								{mode === 'deposit' ? assetSymbol : shareSymbol}
							</span>
						</div>
						{chainId === 31337 && mode === 'deposit' && (
							<Button
								variant='ghost'
								size='sm'
								onClick={onRequestTestTokens}
								className='text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-200 rounded-full h-5 px-1'
							>
								+ 1 000 USDC
							</Button>
						)}
					</div>

					{/* Affichage Dynamique de l'APY */}
					<div className='bg-white/50 rounded-2xl p-4 border border-lgrey flex justify-between items-center'>
						<div>
							<p className='text-xs font-semibold text-navy/50 uppercase tracking-wider'>
								{mode === 'deposit'
									? t('movementCard.globalYield')
									: t('movementCard.yourRealizedYield')}
							</p>
							<p className='text-2xl font-bold text-[#28B092]'>
								{mode === 'deposit' ? globalAPY : userAPY}%{' '}
								<span className='text-sm font-medium text-navy/40'>
									{t('movementCard.annualPercentageYield')}
								</span>
							</p>
						</div>
					</div>

					<div>
						<label className='text-xs font-semibold text-navy/50 uppercase tracking-wider mb-2 block'>
							{mode === 'deposit'
								? t('movementCard.assetToDeposit')
								: t('movementCard.assetToWithdraw')}
						</label>
						<div className='flex gap-2'>
							<Button
								variant={
									selectedAsset === 'USDC'
										? 'default'
										: 'outline'
								}
								className={`flex-1 rounded-2xl border-2 h-12 ${
									selectedAsset === 'USDC'
										? 'border-[#28B092] bg-white text-navy'
										: 'border-lgrey bg-white/50 text-navy/70'
								}`}
								onClick={() => setSelectedAsset(assetSymbol)}
							>
								🔵 USDC
							</Button>
							<div className='relative flex-1'>
								<Button
									disabled
									variant='outline'
									className='w-full rounded-2xl border-2 border-dashed border-lgrey bg-gray-50 text-navy/30 h-12'
								>
									💶 EURC
								</Button>
								<span className='absolute -top-2 -right-1 bg-navy/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full'>
									{t('movementCard.comingSoon')}
								</span>
							</div>
						</div>
					</div>

					{/* Profils de Risque */}
					<div>
						<label className='text-xs font-semibold text-navy/50 uppercase tracking-wider mb-2 block'>
							Profil de risque
						</label>
						<div className='grid grid-cols-2 gap-2'>
							{profiles.map((profile) => (
								<Button
									disabled={!profile.isActive}
									key={profile.id}
									onClick={() =>
										setSelectedProfile(profile.id)
									}
									className={`flex items-center gap-2 px-3 py-2 h-12 rounded-2xl border-2 transition-all text-left ${
										selectedProfile === profile.id
											? `border-transparent text-white shadow-sm ${profile.colorClass || 'bg-navy'}`
											: 'border-lgrey bg-white/50 text-navy/70 hover:border-navy/20'
									}`}
								>
									<span className='text-base flex-shrink-0'>
										{profile.icon}
									</span>
									<div className='min-w-0'>
										<div className='text-xs font-semibold leading-tight truncate'>
											{profile.name}
										</div>
										<div
											className={`text-[10px] leading-tight ${selectedProfile === profile.id ? 'text-white/70' : 'text-navy/40'}`}
										>
											{profile.expectedAPY}
										</div>
									</div>
								</Button>
							))}
						</div>
					</div>

					{/* Input Montant */}
					<div>
						<label className='text-xs font-semibold text-navy/50 uppercase tracking-wider mb-2 block'>
							Montant
						</label>
						<div className='relative'>
							<Input
								type='number'
								placeholder='0.00'
								min='0'
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								disabled={!activeProfile?.isActive}
								className='w-full bg-white border-2 border-lgrey rounded-2xl px-4 py-6 text-2xl font-bold text-navy placeholder:text-navy/20 focus-visible:ring-0 focus-visible:border-[#28B092] transition-colors pr-14 h-auto'
							/>
							<div className='absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2'>
								{/* <button
									onClick={() => setAmount(balance)}
									disabled={!activeProfile?.isActive}
									className='text-xs font-bold text-[#28B092] hover:text-[#2ABFAB] disabled:text-navy/30 transition-colors'
								>
									MAX
								</button> */}
								<span className='text-sm font-semibold text-navy/60'>
									USDC
								</span>
							</div>
						</div>
					</div>

					{/* Bouton d'Action */}
					{/* <Button
						disabled={
							isSubmitDisabled ||
							!activeProfile?.isActive ||
							isPending ||
							!amount
						}
						onClick={sendAmount}
						className='w-full rounded-2xl py-6 text-lg font-bold bg-[#28B092] hover:bg-[#2ABFAB] text-white disabled:opacity-40'
					>
						{mode === 'deposit'
							? needsApproval
								? 'Approuver USDC'
								: 'Déposer'
							: 'Retirer'}{' '}
						{amount ? `${amount} USDC` : ''}
					</Button> */}
					<Button
						disabled={
							isSubmitDisabled ||
							!activeProfile?.isActive ||
							isExecuting ||
							!amount
						}
						onClick={handleInitialClick}
						className='w-full rounded-2xl py-6 text-lg font-bold bg-[#28B092] hover:bg-[#2ABFAB] text-white disabled:opacity-40'
					>
						{isExecuting ? (
							<Loader2 className='mr-2 h-5 w-5 animate-spin' />
						) : null}
						{mode === 'deposit' ? 'Déposer' : 'Retirer'}{' '}
						{amount ? `${amount} USDC` : ''}
					</Button>
				</CardContent>
			</Card>
			{showApproveModal && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'>
					<div className='bg-white dark:bg-gray-900  p-6 rounded-3xl max-w-sm w-full mx-4 shadow-2xl'>
						<h3 className='text-lg font-bold text-navy mb-2'>
							Autorisation requise
						</h3>
						<p className='text-sm text-navy/70 mb-6'>
							Pour déposer vos fonds, vous devez d abord autoriser
							le Vault à utiliser vos <b>{amount} USDC</b>. Cela
							nécessitera <b>deux signatures</b> successives dans
							votre portefeuille.
						</p>
						<div className='flex gap-3'>
							<Button
								variant='outline'
								className='flex-1'
								onClick={() => setShowApproveModal(false)}
								disabled={isExecuting}
							>
								Annuler
							</Button>
							<Button
								className='flex-1 bg-[#28B092] hover:bg-[#2ABFAB] text-white'
								onClick={() => executeTransactionSequence(true)}
								disabled={isExecuting}
							>
								Continuer
							</Button>
						</div>
					</div>
				</div>
			)}
		</>
	);
};
