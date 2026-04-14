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

import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { DepositWithdrawMovementEvent } from '@/data/types/MovementEvent';
import { Address, formatUnits } from 'viem';
// import { Button } from '@/components/ui/button';
import {
	// Link,
	Loader2,
} from 'lucide-react';
import { t } from 'i18next';

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
	return (
		<Card className={cn(className)}>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>
					{loading && (
						<div className='p-8 text-center text-navy/40'>
							<Loader2 className='h-4 w-4 shrink-0 animate-spin' />
							Chargement en cours...
						</div>
					)}
				</CardDescription>
			</CardHeader>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Type</TableHead>
						<TableHead>Montant</TableHead>
						<TableHead>Transaction</TableHead>
						<TableHead>Adresse</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{events.length === 0 && (
						<TableRow>
							<TableCell
								colSpan={3}
								className='text-center py-10'
							>
								<p className='text-navy/40'>Aucun mouvement</p>
							</TableCell>
						</TableRow>
					)}
					{events.map((event, i) => (
						<TableRow
							key={i}
							// className={}
						>
							<TableCell>
								{t(`movements.${event.type}`)}
							</TableCell>
							<TableCell>
								{`${formatUnits(event.assetsAmount, 6)} ${event.type === 'deposit' ? 'USDC' : 'glUSD-P'}`}
							</TableCell>
							<TableCell>
								<a
									href={`https://sepolia.etherscan.io/tx/${event.transactionHash}`}
									target='_blank'
									rel='noopener noreferrer'
									className='text-blue-600 hover:text-blue-800 transition-colors underline '
								>
									{`${event.transactionHash.slice(0, 6)}...${event.transactionHash.slice(-4)}`}
								</a>
							</TableCell>
							<TableCell>
								<a
									href={`https://sepolia.etherscan.io/tx/${event.address}`}
									target='_blank'
									rel='noopener noreferrer'
									className='text-blue-600 hover:text-blue-800 transition-colors underline '
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
