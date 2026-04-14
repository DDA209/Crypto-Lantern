'use client';

import { useState, useEffect, useCallback } from 'react';
import {
	useAccount,
	useReadContract,
	useChainId,
	useWriteContract,
} from 'wagmi';
import { Address, formatUnits, parseAbiItem, parseUnits, type Abi } from 'viem';
import { useLantern } from '@/context/LanternContext';
import VaultPrudentGlUSDPABI from '@/context/VaultPrudentGlUSDP.json';
import MockERC20ABI from '@/context/MockERC20.json';
import AAVEUSDCOwnerABI from '@/context/AAVEUSDCOwner.json';
import usdcAbi from '@/context/USDC.json';
import { MovementCard } from '@/components/shared/cards/movements/MovementCard';
import { getProfiles } from '@/config/profiles';
import { RiskProfile } from '@/data/interfaces/vault';
import { NETWORK_CONFIG } from '@/config/NetworkConfig';
import { publicClient } from '@/lib/client';
import { DepositWithdrawMovementEvent } from '@/data/types/MovementEvent';
import { EventLogsCard } from '@/components/shared/cards/eventLogs/EventLogsCard';
import { t } from 'i18next';

export default function Invest() {
	const { address } = useAccount();
	const chainId = useChainId();
	const { vaultPrudentGlUSDPAddress, usdcAddress, aaveUSDCOwner } =
		useLantern();

	const [events, setEvents] = useState<DepositWithdrawMovementEvent[]>([]);
	const [loadingEvents, setLoadingEvents] = useState(false);

	const baseProfiles = getProfiles(chainId);

	const { data: currentSharePrice } = useReadContract({
		address: vaultPrudentGlUSDPAddress,
		abi: VaultPrudentGlUSDPABI as Abi,
		functionName: 'convertToAssets',
		args: [1000000n],
	});

	// Lecture du timestamp de déploiement pour calculer l'APY
	const { data: deploymentTimestamp } = useReadContract({
		address: vaultPrudentGlUSDPAddress,
		abi: VaultPrudentGlUSDPABI as Abi,
		functionName: 'deploymentTimestamp',
	});

	const calculateVaultAPY = (profileId: string): number => {
		if (
			profileId !== 'glUSD-P' ||
			!currentSharePrice ||
			!deploymentTimestamp
		)
			return 0;

		const initialPrice = 1000000n; // 1.00 USDC
		const currentPrice = currentSharePrice as bigint;
		const startTs = Number(deploymentTimestamp as bigint);
		const nowTs = Math.floor(Date.now() / 1000);

		const daysPassed = (nowTs - startTs) / (24 * 3600);
		if (daysPassed < 1) return 5.25;

		const yieldRate = Number(currentPrice) / Number(initialPrice);
		const apy = (Math.pow(yieldRate, 365 / daysPassed) - 1) * 100;

		return parseFloat(apy.toFixed(2));
	};

	// const calculateUserAPY = (): number => {
	// 	// Use all user transactions of deposit and withdraw to calculate the user APY end share value to define the user APY
	// 	return 0;
	// };

	const RISK_PROFILES: RiskProfile[] = baseProfiles.map((profile) => ({
		...profile,
		expectedAPY: calculateVaultAPY(profile.id),
	}));

	// On prend le premier profil actif par défaut pour l'affichage de base
	const activeVaultProfile = RISK_PROFILES[0];

	const getEvents = useCallback(async () => {
		if (!vaultPrudentGlUSDPAddress || !chainId) return;
		setLoadingEvents(true);
		const fromBlock = NETWORK_CONFIG[chainId]?.fromBlock || 0n;
		try {
			const depositEvents = await publicClient(chainId).getLogs({
				address: vaultPrudentGlUSDPAddress,
				event: parseAbiItem(
					'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
				),
				fromBlock,
				toBlock: 'latest',
			});
			const withdrawEvents = await publicClient(chainId).getLogs({
				address: vaultPrudentGlUSDPAddress,
				event: parseAbiItem(
					'event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
				),
				fromBlock,
				toBlock: 'latest',
			});

			const combined: DepositWithdrawMovementEvent[] = [
				...depositEvents.map((e) => ({
					address: (e.args.sender?.toString() ?? '') as Address,
					assetsAmount: e.args.assets ?? 0n,
					sharesAmount: e.args.shares ?? 0n,
					blockNumber: Number(e.blockNumber),
					transactionHash: e.transactionHash,
					type: 'deposit' as const,
				})),
				...withdrawEvents.map((e) => ({
					address: (e.args.sender?.toString() ?? '') as Address,
					assetsAmount: e.args.assets ?? 0n,
					sharesAmount: e.args.shares ?? 0n,
					blockNumber: Number(e.blockNumber),
					transactionHash: e.transactionHash,
					type: 'withdraw' as const,
				})),
			];

			// const filteredMovements = combined.filter(
			// 	(event) => event.address === address,
			// );

			setEvents(combined.sort((a, b) => b.blockNumber - a.blockNumber));
		} catch {
			setEvents([]);
		} finally {
			setLoadingEvents(false);
		}
	}, [vaultPrudentGlUSDPAddress, chainId]);

	useEffect(() => {
		getEvents();
	}, [vaultPrudentGlUSDPAddress, chainId, getEvents]);

	const { writeContract } = useWriteContract();

	const { data: usdcBalanceData, refetch: refetchUsdc } = useReadContract({
		address: usdcAddress,
		abi: usdcAbi as Abi,
		functionName: 'balanceOf',
		args: address ? [address] : undefined,
		query: { enabled: !!address },
	});

	const { data: sharesBalanceData, refetch: refetchShares } = useReadContract(
		{
			address: activeVaultProfile?.vaultAddress as Address,
			abi: activeVaultProfile?.vaultAbi,
			functionName: 'balanceOf',
			args: address ? [address] : undefined,
			query: { enabled: !!address && !!activeVaultProfile?.vaultAddress },
		},
	);

	const { data: sharePrice, refetch: refetchSharePrice } = useReadContract({
		address: activeVaultProfile?.vaultAddress as Address,
		abi: activeVaultProfile?.vaultAbi,
		functionName: 'convertToAssets',
		args: [BigInt(10 ** 6)],
		query: { enabled: !!address && !!activeVaultProfile?.vaultAddress },
	});

	const formattedUsdcBalance = usdcBalanceData
		? formatUnits(usdcBalanceData as bigint, 6)
		: '0.00';
	const formattedSharesBalance = sharesBalanceData
		? formatUnits(sharesBalanceData as bigint, 6)
		: '0.00';
	const formattedSharesUsdcEqivBalance =
		sharesBalanceData && sharePrice
			? formatUnits(
					((sharesBalanceData as bigint) * (sharePrice as bigint)) /
						BigInt(10 ** 6),
					6,
				)
			: '0.00';

	const refetchAll = useCallback(() => {
		refetchUsdc();
		refetchShares();
		refetchSharePrice();
	}, [refetchUsdc, refetchShares, refetchSharePrice]);

	const mintMockUSDC = () => {
		if (!address || !usdcAddress) {
			console.error(
				`Address ${address ? '✅' : '❌'} | Mock USDC Address ${usdcAddress ? '✅' : '❌'}`,
			);
			return;
		}
		if (chainId !== 31337) {
			console.error(`chainId ${chainId} is not 31337`);
			return;
		}
		console.log(
			`Minting USDC to address ${address} from Mock USDC Address ${usdcAddress}`,
		);
		writeContract({
			address: usdcAddress,
			abi: MockERC20ABI as Abi,
			functionName: 'mint',
			args: [address, parseUnits('1000', 6)],
		});
	};
	const mintTestUSDC = () => {
		if (!address || !usdcAddress || !aaveUSDCOwner) {
			console.error(
				`Address ${address ? '✅' : '❌'} | Test USDC Address ${usdcAddress ? '✅' : '❌'}`,
			);
			return;
		}
		if (chainId !== 11155111) {
			console.error(`chainId ${chainId} is not 11155111`);
			return;
		}

		writeContract({
			address: aaveUSDCOwner,
			abi: AAVEUSDCOwnerABI as Abi,
			functionName: 'mint',
			args: [usdcAddress, address, parseUnits('1000', 6)],
		});
	};

	return (
		<div className='grid grid-cols-1 md:grid-cols-2 gap-8 items-start justify-center py-10 max-w-6xl mx-auto px-4'>
			{/* <div className='flex flex-col gap-8 items-center justify-center py-2 max-w-6xl mx-auto px-4'> */}
			{/* <div className='flex flex-row gap-8 items-center max-w-6xl'> */}
			{/* CARTE DE DÉPÔT */}
			<MovementCard
				refetch={refetchAll}
				getEvents={getEvents}
				mode='deposit'
				chainId={chainId}
				profiles={RISK_PROFILES}
				balance={formattedUsdcBalance}
				globalAPY={calculateVaultAPY('USDC')}
				onRequestMockTokens={mintMockUSDC}
				onRequestTestTokens={mintTestUSDC}
				assetSymbol={activeVaultProfile?.assetSymbol ?? '----'}
				shareSymbol={activeVaultProfile?.shareSymbol ?? '----'}
				vaultAddress={vaultPrudentGlUSDPAddress as Address}
				vaultAbi={VaultPrudentGlUSDPABI as Abi}
				assetAddress={usdcAddress as Address}
			/>

			{/* CARTE DE RETRAIT */}
			<MovementCard
				refetch={refetchAll}
				getEvents={getEvents}
				mode='withdraw'
				chainId={chainId}
				profiles={RISK_PROFILES}
				balance={formattedSharesBalance}
				usdcBalance={formattedSharesUsdcEqivBalance}
				// userAPY={calculateUserAPY()}
				assetSymbol={activeVaultProfile?.assetSymbol ?? '----'}
				shareSymbol={activeVaultProfile?.shareSymbol ?? '----'}
				vaultAddress={vaultPrudentGlUSDPAddress as Address}
				vaultAbi={VaultPrudentGlUSDPABI as Abi}
				assetAddress={usdcAddress as Address}
			/>
			{/* </div> */}
			<EventLogsCard
				title={t('invest.historyTitle')}
				events={events}
				loading={loadingEvents}
				className='w-full md:col-span-2'
				userAddress={address}
			/>
		</div>
	);
}
