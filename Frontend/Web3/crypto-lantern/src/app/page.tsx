'use client';

import Login from '@/components/pages/login/login.page';
import { useConnection } from 'wagmi';
import Dashboard from '@/components/pages/dashboard/dashboard.page';

export default function Home() {
	const { isConnected } = useConnection();

	return <>{isConnected ? <Dashboard /> : <Login />}</>;
}

