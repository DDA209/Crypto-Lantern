'use client';

import {
	Table,
	TableHeader,
	TableRow,
	TableBody,
	TableHead,
	TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { DepositWithdrawMovementEvent } from '@/data/types/MovementEvent';
import { Address, formatUnits } from 'viem';
// import { Button } from '@/components/ui/button';
import {
	// Link,
	Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '@/hooks/useCurrency';

interface EventLogsCardProps {
	title: string;
	events: DepositWithdrawMovementEvent[];
	loading: boolean;
	className?: string;
	userAddress?: Address;
}
export const EventLogsCard = ({
	title,
	events,
	loading,
	className,
	userAddress,
}: EventLogsCardProps) => {
	const { t } = useTranslation();
	const { formatCurrency } = useCurrency();
	return (
		<Card className={cn(className)}>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>{t('eventLogs.type')}</TableHead>
						<TableHead>{t('eventLogs.amount')}</TableHead>
						<TableHead>{t('eventLogs.transaction')}</TableHead>
						<TableHead>{t('eventLogs.address')}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{loading && (
						<div className='p-8 text-center text-navy/40'>
							<Loader2 className='h-4 w-4 shrink-0 animate-spin' />
							{t('eventLogs.loading')}
						</div>
					)}
					{events.length === 0 && (
						<TableRow>
							<TableCell
								colSpan={4}
								className='text-center py-10'
							>
								<p className='text-navy/40'>
									{t('eventLogs.noMovement')}
								</p>
							</TableCell>
						</TableRow>
					)}
					{events.map((event, i) => (
						<TableRow
							key={i}
							className={`${
								event.type === 'deposit'
									? `${event.address === userAddress ? 'text-[#28B092] bg-[#28B092]/20' : 'text-[#28B092]/80 bg-[#28B092]/5'}`
									: `${event.address === userAddress ? 'text-orange-500 bg-orange-500/20' : 'text-orange-500/80 bg-orange-500/5'}`
							} ${
								event.address === userAddress ? 'font-bold' : ''
							} `}
						>
							<TableCell>
								{t(`movements.${event.type}`)}
							</TableCell>
							<TableCell>
								{`${formatCurrency(formatUnits(event.assetsAmount, 6))} ${event.type === 'deposit' ? 'USDC' : 'glUSD-P'}`}
							</TableCell>
							<TableCell>
								<a
									href={`https://sepolia.etherscan.io/tx/${event.transactionHash}`}
									target='_blank'
									rel='noopener noreferrer'
									className='text-gray-400 hover:text-white transition-colors underline '
								>
									{`${event.transactionHash.slice(0, 6)}...${event.transactionHash.slice(-4)}`}
								</a>
							</TableCell>
							<TableCell>
								<a
									href={`https://sepolia.etherscan.io/tx/${event.address}`}
									target='_blank'
									rel='noopener noreferrer'
									className='text-gray-400 hover:text-white transition-colors underline '
								>
									{`${event.address.slice(0, 6)}...${event.address.slice(-4)}`}
								</a>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</Card>
	);
};
