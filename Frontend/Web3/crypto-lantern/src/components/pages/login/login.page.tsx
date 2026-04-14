'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppTitle from '@/components/shared/AppTitle';
import ConnectButton from '@/components/ui/buttons/ConnectButton';
import { LanguageSwitcher } from '@/components/ui/toggles/LanguageSwitcher';
import Link from 'next/link';
import { useTheme } from 'next-themes';

const NotConnected = () => {
	const { t } = useTranslation();
	const [randomNumber] = useState<number>(
		() => Math.floor(Math.random() * 1) + 1, // Génère 1, 2 ou 3 (ajustez selon le nombre d'images que vous avez)
	);

	return (
		<div className='flex flex-1 items-center flex-row'>
			<div
				id='left-column'
				className='w-3/7 h-full hidden md:block p-4'
			>
				<div
					className='flex flex-1 h-full bg-no-repeat bg-center bg-cover rounded-lg'
					style={{
						backgroundImage: `url('/start-${randomNumber}.png')`,
					}}
				>
					<div className='m-4 top-4 flex-1'>
						<AppTitle rounded={true} />
					</div>
				</div>
			</div>
			<div
				id='right-column'
				className='w-4/7 m-0 p-0 h-full flex items-center justify-center flex-col'
			>
				<div className='w-full md:hidden'>
					<AppTitle
						fullLogo={true}
						opacity={75}
					/>
				</div>
				<div className='flex-1 m-0 p-5 h-full flex items-center justify-center flex-col'>
					<LanguageSwitcher style='absolute top-4 right-4' />
					<h1 className='text-(--primary-color) text-center text-3xl sm:text-4xl md:text-5xl font-extrabold text-navy leading-tight mb-6'>
						{t('home.welcome')}
					</h1>
					<p className='text-center text-lg text-navy/60 leading-relaxed mb-10 max-w-2xl mx-auto'>
						{t('home.connectLine1')}
						<Link
							href='https://ethereum.org/wallets/'
							target='_blank'
							rel='noopener noreferrer'
							className='underline text-blue-500'
						>
							{t('home.connectLink')}
						</Link>
						{t('home.connectLine2')}
					</p>
					<ConnectButton />
				</div>
				<div className='w-full md:hidden h-30'>&nbsp;</div>
			</div>
		</div>
	);
};

export default NotConnected;
