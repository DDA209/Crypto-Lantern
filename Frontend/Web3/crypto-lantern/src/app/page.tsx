'use client';

import Login from '@/components/pages/login/login.page';
import { useConnection } from 'wagmi';
import Invest from '@/components/pages/invest/invest.page';

export default function Home() {
	const { isConnected } = useConnection();

	return <>{isConnected ? <Invest /> : <Login />}</>;
}

