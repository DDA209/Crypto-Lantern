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
	return (
		<Card>
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
						<TableHead>Origine</TableHead>
						<TableHead>Valeur du Buffer</TableHead>
						<TableHead>Retiré pour réallocation</TableHead>
						<TableHead>Réinvesti</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{events.map((event) => (
						<TableRow key={event.transactionHash}>
							<TableCell>
								{event.force ? 'Manuel' : 'Harvest'}
							</TableCell>
							<TableCell>{event.newBuffer}</TableCell>
							<TableCell>{event.divestedAmout}</TableCell>
							<TableCell>{event.reinvestedAmout}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</Card>
	);
};
