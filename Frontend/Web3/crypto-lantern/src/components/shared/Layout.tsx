'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Footer from '@/components/shared/Footer';
import Header from '@/components/shared/Header';
import { useConnection } from 'wagmi';
import { LanternProvider } from '@/context/LanternContext';
import { useTheme } from 'next-themes';
import Image from 'next/image';

const Layout = ({ children }: { children: React.ReactNode }) => {
	const { isConnected } = useConnection();
	const pathname = usePathname();
	const router = useRouter();

	const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
	const [mounted, setMounted] = useState(false);
	const { theme } = useTheme();

	useEffect(
		() => {
			const timer = setTimeout(() => {
				setMounted(true);
			}, 0);

			const handleMouseMove = (e: MouseEvent) => {
				setMousePos({ x: e.clientX, y: e.clientY });
			};
			window.addEventListener('mousemove', handleMouseMove);
			return () => {
				clearTimeout(timer);
				window.removeEventListener('mousemove', handleMouseMove);
			};
		},
		// [selectedProfile]
		[],
	);

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
					{/* Effet Curseur Volant (Lantern) */}
					{theme === 'dark' && mounted && (
						<>
							<div
								className='pointer-events-none fixed z-40 rounded-full'
								style={{
									width: '350px',
									height: '350px',
									background: `radial-gradient(circle, rgba(255, 215, 100, 0.15) 0%, transparent 65%)`,
									backdropFilter: `brightness(1.06)`,
									left: `${mousePos.x - 168}px`,
									top: `${mousePos.y - 145}px`,
								}}
							/>
							<Image
								src={`/lantern-logo-dark.svg`}
								width={30}
								height={30}
								alt=''
								className='pointer-events-none fixed z-30 h-8'
								style={{
									borderRadius: '50%',
									width: '30px',
									height: '30px',
									left: `${mousePos.x - 7}px`,
									top: `${mousePos.y + 17}px`,
								}}
							/>
						</>
					)}

					{children}
				</main>
				{isConnected && <Footer />}
			</LanternProvider>
		</div>
	);
};

export default Layout;
