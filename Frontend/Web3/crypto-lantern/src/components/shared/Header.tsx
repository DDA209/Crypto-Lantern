import Link from 'next/link';
import ConnectButton from '../ui/buttons/ConnectButton';
import { appName } from '@/config';
import Image from 'next/image';
import { useLantern } from '@/context/LanternContext';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useTheme } from 'next-themes';

const Header = () => {
	const { isDao } = useLantern();
	const { t } = useTranslation();
	const { theme } = useTheme();

	return (
		<header className='sticky top-0 z-50 bg-white dark:bg-gray-900 transition-shadow duration-300 shadow-sm border-b border-gray-200 dark:border-gray-800'>
			<div className='max-w-6xl mx-auto px-4'>
				<div className='flex items-center justify-between h-16'>
					<Link
						href='/'
						className='flex items-center gap-2 group'
					>
						<Image
							src={`/lantern-logo-${theme ?? 'light'}.svg`}
							alt='Logo'
							width={24}
							height={40}
						/>
						<span className='font-bold text-lg tracking-tight text-[#3979d6]'>
							{appName}
						</span>
					</Link>
					<nav className='hidden md:flex items-center gap-5'>
						<button className='text-sm font-medium transition-colors duration-200 text-gray-700 dark:text-gray-300 hover:text-[#3979d6] dark:hover:text-[#3979d6]'>
							<Link href='/'>{t('header.invest')}</Link>
						</button>
						{isDao ? (
							<button className='text-sm font-medium transition-colors duration-200 text-gray-700 dark:text-gray-300 hover:text-[#3979d6] dark:hover:text-[#3979d6]'>
								<Link href='/admin'>{t('header.admin')}</Link>
							</button>
						) : null}
					</nav>
					<div className='flex items-center gap-2 sm:gap-4'>
						<ThemeToggle />
						<LanguageSwitcher />
						<ConnectButton />
					</div>
				</div>
			</div>
		</header>
	);
};

export default Header;

