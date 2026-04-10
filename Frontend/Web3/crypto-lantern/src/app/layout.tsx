import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

import { headers } from 'next/headers'; // added
import ContextProvider from '@/context';
import Layout from '@/components/shared/Layout';
import { appName, appDescription } from '@/config';
import { ThemeProvider } from '@/components/shared/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
	title: appName,
	description: appDescription,
};

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const headersObj = await headers();
	const cookies = headersObj.get('cookie');

	return (
		<html
			lang='fr'
			suppressHydrationWarning
			translate='no'
		>
			<body className={inter.className}>
				<ThemeProvider
					attribute='class'
					defaultTheme='system'
					enableSystem
				>
					<ContextProvider cookies={cookies}>
						<Layout>
							{children}
							<Toaster />
						</Layout>
					</ContextProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
