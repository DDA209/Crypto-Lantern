import { useTranslation } from 'react-i18next';

export const useCurrency = () => {
	const { i18n } = useTranslation();

	const formatCurrency = (value: number | string | bigint) => {
		// On récupère la langue actuelle (ex: 'fr', 'en', 'es')
		const locale = i18n.language || 'en';

		return new Intl.NumberFormat(locale, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(Number(value));
	};

	return { formatCurrency };
};
