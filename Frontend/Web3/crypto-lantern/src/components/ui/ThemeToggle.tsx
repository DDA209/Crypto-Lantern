'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
	const { theme, setTheme, systemTheme } = useTheme();
	const [mounted, setMounted] = React.useState(false);

	React.useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return <div className="w-8 h-8" />; // Placeholder le temps que mounted passe à true
	}

	const currentTheme = theme === 'system' ? systemTheme : theme;

	return (
		<button
			onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
			className='relative flex items-center justify-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300'
			aria-label='Toggle theme'
		>
			<Sun className={`h-[1.2rem] w-[1.2rem] transition-all ${currentTheme === 'dark' ? 'scale-0 -rotate-90' : 'scale-100 rotate-0'}`} />
			<Moon className={`absolute h-[1.2rem] w-[1.2rem] transition-all ${currentTheme === 'dark' ? 'scale-100 rotate-0' : 'scale-0 rotate-90'}`} />
		</button>
	);
}
