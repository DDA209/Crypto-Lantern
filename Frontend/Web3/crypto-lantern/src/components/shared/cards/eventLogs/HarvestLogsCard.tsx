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
							Chargement en cours...
						</div>
					)}
				</CardDescription>
			</CardHeader>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Rendement</TableHead>
						<TableHead>Frais</TableHead>
						<TableHead>gl-USDP</TableHead>
						<TableHead>Total investi</TableHead>
						<TableHead>Hash de la transaction</TableHead>
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
