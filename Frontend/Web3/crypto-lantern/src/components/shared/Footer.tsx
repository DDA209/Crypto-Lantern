import { appName } from '@/config';
import { LanguageSwitcher } from '../ui/toggles/LanguageSwitcher';

const Footer = () => {
	return (
		<footer className='bg-navy text-white'>
			<div className='border-t border-black/10 dark:border-white/10'>
				<div className='max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2'>
					<p className='text-black/50 dark:text-white/40 text-xs'>
						&copy; {new Date().getFullYear()} {appName}. All rights
						reserved.
					</p>
					<p className='flex items-center gap-2 text-black/50 dark:text-white/40 text-xs'>
						<span>
							<a
								href='https://www.cryptoluciole.com/#whitepaper'
								target='_blank'
								rel='noopener noreferrer'
							>
								Whitepaper
							</a>
						</span>
						-
						<span>
							<a
								href='https://www.cryptoluciole.com/'
								target='_blank'
								rel='noopener noreferrer'
							>
								Legal
							</a>
						</span>
					</p>

					<div className='flex items-center gap-2'>
						<LanguageSwitcher />
						<span className='text-xs text-black/50 dark:text-white/40 bg-white/5 px-2.5 py-1 rounded-full'>
							v0.1.0
						</span>
					</div>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
