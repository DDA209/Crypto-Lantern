import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import React, { useEffect, useState } from 'react';

interface DashboardCardProps {
	title: string;
	icon: React.ReactNode;
	span?: number;
	content: React.ReactNode;
	theme?: string;
}

export default function DashboardCard({
	title,
	icon,
	span,
	content,
	theme,
}: DashboardCardProps) {
	// do a number with 2 decimals move 0.01 per 0.01 every 100ms between 2 and 10 forwarding from 2 to 10 and backward from 10 to 2 cyclically

	return (
		<Card
			className={`bg-white dark:bg-black border-none shadow-md ${span && span > 1 && 'md:col-span-' + span}`}
			style={
				theme === 'dark'
					? { boxShadow: `rgba(255, 215, 100, 0.4) 0px 0px 9px 1px` }
					: {}
			}
		>
			<CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
				<CardTitle className='text-sm font-medium'>{title}</CardTitle>
				{icon}
			</CardHeader>
			<CardContent className='space-y-4'>{content}</CardContent>
		</Card>
	);
}
