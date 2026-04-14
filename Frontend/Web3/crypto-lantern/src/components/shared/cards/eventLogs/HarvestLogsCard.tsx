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
import { HarvestMovementEvent } from '@/data/types/MovementEvent';
// import { Button } from '@/components/ui/button';
import {
	// Link,
	Loader2,
} from 'lucide-react';
import { t } from 'i18next';

interface HarvestEventLogsCardProps {
	title: string;
	events: HarvestMovementEvent[];
	loading: boolean;
}
export const HarvestEventLogsCard = ({
	title,
	events,
	loading,
}: HarvestEventLogsCardProps) => {
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
						<TableHead>{t('eventLogs.yield')}</TableHead>
						<TableHead>{t('eventLogs.fees')}</TableHead>
						<TableHead>{t('eventLogs.glUSDP')}</TableHead>
						<TableHead>{t('eventLogs.totalInvested')}</TableHead>
						<TableHead>{t('eventLogs.transaction')}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{events.map((event) => (
						<TableRow key={event.transactionHash}>
							<TableCell>{event.yield}</TableCell>
							<TableCell>{event.fees}</TableCell>
							<TableCell>{event.sharesToMint}</TableCell>
							<TableCell>{event.totalAssets}</TableCell>
							<TableCell>{event.transactionHash}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</Card>
	);
};
