'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';

export function LanguageSwitcher({ style }: { style?: string }) {
	const { i18n } = useTranslation();
	const [mounted, setMounted] = React.useState(false);

	React.useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return <div className='w-12 h-6' />;
	}

	const changeLanguage = (lng: string) => {
		i18n.changeLanguage(lng);
	};

	return (
		<div
			className={`flex gap-2 items-center text-sm font-medium ml-4 ${style}`}
		>
			<button
				onClick={() => changeLanguage('fr')}
				className={`hover:text-[#28b092] transition-colors ${i18n.resolvedLanguage?.startsWith('fr') ? 'text-[#28b092] font-bold' : 'text-gray-500 dark:text-gray-400'}`}
			>
				FR
			</button>
			<span className='text-gray-300 dark:text-gray-600'>|</span>
			<button
				onClick={() => changeLanguage('en')}
				className={`hover:text-[#28b092] transition-colors ${i18n.resolvedLanguage?.startsWith('en') ? 'text-[#28b092] font-bold' : 'text-gray-500 dark:text-gray-400'}`}
			>
				EN
			</button>
		</div>
	);
}
