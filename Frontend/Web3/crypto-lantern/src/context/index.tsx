'use client';

import { wagmiAdapter, projectId, appName } from '@/config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppKit, useAppKitTheme } from '@reown/appkit/react';
import {
	mainnet,
	// arbitrum,
	sepolia,
	hardhat,
} from '@reown/appkit/networks';
import React, { useEffect, type ReactNode } from 'react';
import { cookieToInitialState, WagmiProvider, type Config } from 'wagmi';
import { useTheme } from 'next-themes';

// Set up queryClient
const queryClient = new QueryClient();

if (!projectId) {
	throw new Error('Project ID is not defined');
}

// Set up metadata
const metadata = {
	name: appName,
	description: appName,
	url: 'https://appkitexampleapp.com', // origin must match your domain & subdomain
	icons: ['https://avatars.githubusercontent.com/u/179229932'],
};

// Create the modal
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const modal = createAppKit({
	adapters: [wagmiAdapter],
	projectId,
	networks: [
		mainnet,
		// arbitrum,
		sepolia,
		hardhat,
	],
	defaultNetwork: hardhat,
	metadata: metadata,
	features: {
		analytics: true, // Optional - defaults to your Cloud configuration
	},
	themeVariables: {
		'--w3m-font-family': 'Inter, system-ui, sans-serif',
		'--w3m-accent': '#2ABFAB',
		'--w3m-color-mix': '#2ABFAB',
		'--w3m-z-index': 1000,
		'--apkt-font-family': 'Inter, system-ui, sans-serif',
		'--apkt-accent': '#2ABFAB',
		'--apkt-color-mix': '#2ABFAB',
		'--apkt-z-index': 1000,
	},
});

function ThemeSync() {
	const { resolvedTheme } = useTheme(); // resolvedTheme donne 'light' ou 'dark' (gère le mode système)
	const { setThemeMode } = useAppKitTheme(); // Le contrôleur de thème d'AppKit

	useEffect(() => {
		if (resolvedTheme) {
			setThemeMode(resolvedTheme as 'light' | 'dark');
		}
	}, [resolvedTheme, setThemeMode]);

	return null;
}

function ContextProvider({
	children,
	cookies,
}: {
	children: ReactNode;
	cookies: string | null;
}) {
	const initialState = cookieToInitialState(
		wagmiAdapter.wagmiConfig as Config,
		cookies,
	);

	return (
		<WagmiProvider
			config={wagmiAdapter.wagmiConfig as Config}
			initialState={initialState}
		>
			<QueryClientProvider client={queryClient}>
				<ThemeSync />
				{children}
			</QueryClientProvider>
		</WagmiProvider>
	);
}

export default ContextProvider;
