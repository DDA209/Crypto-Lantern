'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Image from 'next/image';

// --- Types ---
export interface Network {
	id: number;
	name: string;
}

export interface RiskProfile {
	id: string;
	name: string;
	icon: string;
	expectedApy: string;
	isActive: boolean; // Seul glUSD-P sera true pour le moment
	colorClass?: string; // Pour gérer les couleurs spécifiques (ex: orange pour glUSD-B)
}

interface VaultCardProps {
	mode: 'deposit' | 'withdraw';
	networks: Network[];
	profiles: RiskProfile[];
	balance: string;
	globalApy?: number;
	userApy?: number;
	onAction: (amount: string, profileId: string) => void;
	onRequestTestTokens?: () => void;
}

export function VaultCard({
	mode,
	networks,
	profiles,
	balance,
	globalApy,
	userApy,
	onAction,
	onRequestTestTokens,
}: VaultCardProps) {
	const [selectedAsset, setSelectedAsset] = useState<'USDC' | 'EURC'>('USDC');
	const [selectedProfile, setSelectedProfile] = useState<string>('glUSD-P');
	const [amount, setAmount] = useState<string>('');

	// Gestion du curseur personnalisé pour le profil glUSD-AH
	const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
	const isCustomCursorActive = selectedProfile === 'glUSD-AH';

	useEffect(() => {
		if (!isCustomCursorActive) return;
		const handleMouseMove = (e: MouseEvent) => {
			setMousePos({ x: e.clientX, y: e.clientY });
		};
		window.addEventListener('mousemove', handleMouseMove);
		return () => window.removeEventListener('mousemove', handleMouseMove);
	}, [isCustomCursorActive]);

	const activeProfile = profiles.find((p) => p.id === selectedProfile);
	const isSubmitDisabled =
		!amount || Number(amount) <= 0 || !activeProfile?.isActive;

	return (
		<>
			{/* Effet Curseur Volant (Lantern) */}
			{isCustomCursorActive && (
				<>
					<div
						className='pointer-events-none fixed z-40 rounded-full'
						style={{
							width: '350px',
							height: '350px',
							background:
								'radial-gradient(circle, rgba(255, 215, 0, 0.15) 0%, transparent 65%)',
							left: mousePos.x - 175,
							top: mousePos.y - 175,
						}}
					/>
					<Image
						src='/lantern-logo-black.svg'
						alt=''
						className='pointer-events-none fixed z-50 h-8'
						style={{
							filter: 'drop-shadow(rgba(255, 215, 0, 0.9) 0px 0px 8px)',
							left: mousePos.x + 15,
							top: mousePos.y + 15,
						}}
					/>
				</>
			)}

			<Card className='bg-bg rounded-3xl border-none shadow-xl w-full max-w-md mx-auto'>
				<CardContent className='p-6 sm:p-8 flex flex-col gap-6'>
					{/* Header : AppKit Button & Solde */}
					<div className='flex items-center justify-between flex-wrap gap-2'>
						{/* L'emplacement idéal pour le composant <appkit-button /> de Reown */}
						<div
							id='appkit-network-selector'
							className='rounded-full bg-gray-800 text-white px-4 py-2 text-sm font-medium'
						>
							{networks[0]?.name || 'Connect Wallet'}
						</div>
						<div className='text-xs text-navy/40'>
							Solde :{' '}
							<span className='font-medium text-navy/60'>
								{balance} USDC
							</span>
						</div>
					</div>

					{/* Affichage Dynamique de l'APY */}
					<div className='bg-white/50 rounded-2xl p-4 border border-lgrey flex justify-between items-center'>
						<div>
							<p className='text-xs font-semibold text-navy/50 uppercase tracking-wider'>
								{mode === 'deposit'
									? 'Rendement Global'
									: 'Votre Rendement Réalisé'}
							</p>
							<p className='text-2xl font-bold text-[#28B092]'>
								{mode === 'deposit' ? globalApy : userApy}%{' '}
								<span className='text-sm font-medium text-navy/40'>
									APY
								</span>
							</p>
						</div>
					</div>

					{/* Faucet (Optionnel, affiché uniquement en dev/testnet) */}
					{onRequestTestTokens && (
						<div className='bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between'>
							<span className='text-xs font-semibold text-amber-800'>
								Réseau Test
							</span>
							<Button
								variant='ghost'
								size='sm'
								onClick={onRequestTestTokens}
								className='text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-full h-7 px-3'
							>
								+ 1 000 USDC de test
							</Button>
						</div>
					)}

					{/* Sélection de l'Actif */}
					<div>
						<label className='text-xs font-semibold text-navy/50 uppercase tracking-wider mb-2 block'>
							Actif à {mode === 'deposit' ? 'déposer' : 'retirer'}
						</label>
						<div className='flex gap-2'>
							<Button
								variant={
									selectedAsset === 'USDC'
										? 'default'
										: 'outline'
								}
								className={`flex-1 rounded-2xl border-2 h-12 ${
									selectedAsset === 'USDC'
										? 'border-[#28B092] bg-white text-navy'
										: 'border-lgrey bg-white/50 text-navy/70'
								}`}
								onClick={() => setSelectedAsset('USDC')}
							>
								🔵 USDC
							</Button>
							<div className='relative flex-1'>
								<Button
									disabled
									variant='outline'
									className='w-full rounded-2xl border-2 border-dashed border-lgrey bg-gray-50 text-navy/30 h-12'
								>
									💶 EURC
								</Button>
								<span className='absolute -top-2 -right-1 bg-navy/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full'>
									Bientôt
								</span>
							</div>
						</div>
					</div>

					{/* Profils de Risque */}
					<div>
						<label className='text-xs font-semibold text-navy/50 uppercase tracking-wider mb-2 block'>
							Profil de risque
						</label>
						<div className='grid grid-cols-2 gap-2'>
							{profiles.map((profile) => (
								<button
									key={profile.id}
									onClick={() =>
										setSelectedProfile(profile.id)
									}
									className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl border-2 transition-all text-left ${
										selectedProfile === profile.id
											? `border-transparent text-white shadow-sm ${profile.colorClass || 'bg-navy'}`
											: 'border-lgrey bg-white/50 text-navy/70 hover:border-navy/20'
									}`}
								>
									<span className='text-base flex-shrink-0'>
										{profile.icon}
									</span>
									<div className='min-w-0'>
										<div className='text-xs font-semibold leading-tight truncate'>
											{profile.name}
										</div>
										<div
											className={`text-[10px] leading-tight ${selectedProfile === profile.id ? 'text-white/70' : 'text-navy/40'}`}
										>
											{profile.expectedApy}
										</div>
									</div>
								</button>
							))}
						</div>
					</div>

					{/* Input Montant */}
					<div>
						<label className='text-xs font-semibold text-navy/50 uppercase tracking-wider mb-2 block'>
							Montant
						</label>
						<div className='relative'>
							<Input
								type='number'
								placeholder='0.00'
								min='0'
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								disabled={!activeProfile?.isActive}
								className='w-full bg-white border-2 border-lgrey rounded-2xl px-4 py-6 text-2xl font-bold text-navy placeholder:text-navy/20 focus-visible:ring-0 focus-visible:border-[#28B092] transition-colors pr-24 h-auto'
							/>
							<div className='absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2'>
								<button
									onClick={() => setAmount(balance)}
									disabled={!activeProfile?.isActive}
									className='text-xs font-bold text-[#28B092] hover:text-[#2ABFAB] disabled:text-navy/30 transition-colors'
								>
									MAX
								</button>
								<span className='text-sm font-semibold text-navy/60'>
									USDC
								</span>
							</div>
						</div>
					</div>

					{/* Bouton d'Action */}
					<Button
						disabled={isSubmitDisabled}
						onClick={() => onAction(amount, selectedProfile)}
						className='w-full rounded-2xl py-6 text-lg font-bold bg-[#28B092] hover:bg-[#2ABFAB] text-white disabled:opacity-40'
					>
						{mode === 'deposit' ? 'Déposer' : 'Retirer'}{' '}
						{amount ? `${amount} USDC` : ''}
					</Button>

					<p className='text-center text-xs text-navy/30 font-medium'>
						⚠️ Projet académique Alyra — Ne pas utiliser de vrais
						fonds.
					</p>
				</CardContent>
			</Card>
		</>
	);
}
