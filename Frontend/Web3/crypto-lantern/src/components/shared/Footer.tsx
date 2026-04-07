import { appName } from '@/config';

const Footer = () => {
	return (
		<footer className='bg-navy text-white'>
			<div className='border-t border-white/10'>
				<div className='max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2'>
					<p className='text-white/30 text-xs'>
						&copy; {new Date().getFullYear()} {appName}. All rights
						reserved.
					</p>
					<span className='text-xs text-white/20 bg-white/5 px-2.5 py-1 rounded-full'>
						v0.1.0
					</span>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
