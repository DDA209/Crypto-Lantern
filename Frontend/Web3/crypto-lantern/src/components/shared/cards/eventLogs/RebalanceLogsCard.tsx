'use client';

import {
	Table,
	TableHeader,
	TableRow,
	TableBody,
	TableHead,
	TableCell,
} from '@/components/ui/table';

import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { RebalanceMovementEvent } from '@/data/types/MovementEvent';
// import { Button } from '@/components/ui/button';
import {
	// Link,
	Loader2,
} from 'lucide-react';
import { formatUnits } from 'viem';
import { useTranslation } from 'react-i18next';

interface RebalanceEventLogsCardProps {
	title: string;
	events: RebalanceMovementEvent[];
	loading: boolean;
}
export const RebalanceEventLogsCard = ({
	title,
	events,
	loading,
}: RebalanceEventLogsCardProps) => {
	const { t } = useTranslation();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>
					{loading && (
						<div className='p-8 text-center text-navy/40'>
							<Loader2 className='h-4 w-4 shrink-0 animate-spin' />
							{t('eventLogs.loading')}
						</div>
					)}
				</CardDescription>
			</CardHeader>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>{t('eventLogs.origin')}</TableHead>
						<TableHead>{t('eventLogs.bufferShare')}</TableHead>
						<TableHead>{t('eventLogs.investedShare')}</TableHead>
						<TableHead>{t('eventLogs.reinvestedShare')}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{events.map((event) => (
						<TableRow key={event.transactionHash}>
							<TableCell>
								{event.force
									? t('eventLogs.manual')
									: t('eventLogs.harvest')}
							</TableCell>
							<TableCell>
								{formatUnits(event.newBuffer ?? 0n, 6)}
							</TableCell>
							<TableCell>
								{formatUnits(event.currentTotalAssets ?? 0n, 6)}
							</TableCell>
							<TableCell>
								{formatUnits(event.reinvestedAmout ?? 0n, 6)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</Card>
	);
};
