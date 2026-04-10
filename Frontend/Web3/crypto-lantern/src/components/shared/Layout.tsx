'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Footer from '@/components/shared/Footer';
import Header from '@/components/shared/Header';
import { useConnection } from 'wagmi';
import { LanternProvider } from '@/context/LanternContext';

const Layout = ({ children }: { children: React.ReactNode }) => {
	const { isConnected } = useConnection();
	const pathname = usePathname();
	const router = useRouter();

	// Rediriger vers l'accueil si l'utilisateur n'est pas connecté et essaie d'accéder à une autre page
	useEffect(() => {
		if (!isConnected && pathname !== '/') {
			router.push('/');
		}
	}, [isConnected, pathname, router]);

	// Empêcher l'affichage de la page protégée pendant la redirection
	if (!isConnected && pathname !== '/') {
		return null;
	}

	return (
		<div className='min-h-screen flex flex-col'>
			<LanternProvider>
				{isConnected && <Header />}
				<main className='flex-1 flex p-4 mx-auto w-full '>
					{children}
				</main>
				{isConnected && <Footer />}
			</LanternProvider>
		</div>
	);
};

export default Layout;
