import Link from 'next/link';
import ConnectButton from '../ui/buttons/ConnectButton';
import { appName } from '@/config';
import Image from 'next/image';
import { useLantern } from '@/context/LanternContext';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '@/components/ui/toggles/ThemeToggle';
import { useTheme } from 'next-themes';
import { useState } from 'react';

const Header = () => {
	const { isTeam, isNewTeam, isDao, isNewDao } = useLantern();
	const { t } = useTranslation();
	const { theme } = useTheme();

	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	const closeMobileMenu = () => setIsMobileMenuOpen(false);

	return (
		<header className='sticky top-0 z-50 bg-white dark:bg-gray-900 transition-shadow duration-300 shadow-xs border-b border-gray-100 dark:border-gray-800'>
			<div className='max-w-7xl mx-auto'>
				<div className='flex items-center justify-between h-16'>
					<div className='flex items-center gap-2 group'>
						<Image
							src={`/lantern-logo-${theme ?? 'light'}.svg`}
							alt='Logo'
							width={24}
							height={40}
							className='ml-1'
							onClick={() =>
								setIsMobileMenuOpen(!isMobileMenuOpen)
							}
						/>
						{/* Navigation Mobile (Drop-down) */}
						{isMobileMenuOpen && (
							<div
								className='md:hidden border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 top-16 absolute'
								style={{ borderRadius: '0 0 10px 0' }}
							>
								<nav className='flex flex-col px-4 pt-2 pb-4 space-y-3'>
									<Link
										suppressHydrationWarning
										href='/'
										onClick={closeMobileMenu}
										className='block text-base font-medium text-gray-700 dark:text-gray-300 hover:text-[#28b092] dark:hover:text-[#28b092]'
									>
										{t('header.home')}
									</Link>
									<Link
										suppressHydrationWarning
										href='/invest'
										onClick={closeMobileMenu}
										className='block text-base font-medium text-gray-700 dark:text-gray-300 hover:text-[#28b092] dark:hover:text-[#28b092]'
									>
										{t('header.invest')}
									</Link>
									{(isTeam ||
										isNewTeam ||
										isBackdoorAdmin) && (
										<Link
											href='/team'
											onClick={closeMobileMenu}
											className='block text-base font-medium text-gray-700 dark:text-gray-300 hover:text-[#28b092] dark:hover:text-[#28b092]'
										>
											{t('header.team')}
										</Link>
									)}
									{(isDao || isNewDao || isBackdoorAdmin) && (
										<Link
											href='/dao'
											onClick={closeMobileMenu}
											className='block text-base font-medium text-gray-700 dark:text-gray-300 hover:text-[#28b092] dark:hover:text-[#28b092]'
										>
											{t('header.dao')}
										</Link>
									)}
								</nav>
							</div>
						)}
						<span className='hidden md:block font-bold text-lg tracking-tight text-[#28b092]'>
							{appName}
						</span>
					</div>

					<nav className='hidden md:flex items-center gap-5'>
						<button className='text-sm font-medium transition-colors duration-200 text-gray-700 dark:text-gray-300 hover:text-[#28b092] dark:hover:text-[#28b092]'>
							<Link
								suppressHydrationWarning
								href='/'
							>
								{t('header.home')}
							</Link>
						</button>
						<button className='text-sm font-medium transition-colors duration-200 text-gray-700 dark:text-gray-300 hover:text-[#28b092] dark:hover:text-[#28b092]'>
							<Link
								suppressHydrationWarning
								href='/invest'
							>
								{t('header.invest')}
							</Link>
						</button>
						{isTeam || isNewTeam ? (
							<button className='text-sm font-medium transition-colors duration-200 text-gray-700 dark:text-gray-300 hover:text-[#28b092] dark:hover:text-[#28b092]'>
								<Link href='/team'>{t('header.team')}</Link>
							</button>
						) : null}
						{isDao || isNewDao ? (
							<button className='text-sm font-medium transition-colors duration-200 text-gray-700 dark:text-gray-300 hover:text-[#28b092] dark:hover:text-[#28b092]'>
								<Link href='/dao'>{t('header.dao')}</Link>
							</button>
						) : null}
					</nav>
					<div className='flex items-center gap-2 sm:gap-4'>
						<ThemeToggle />
						<ConnectButton />
					</div>
				</div>
			</div>
		</header>
	);
};

export default Header;
