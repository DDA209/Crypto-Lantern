import { expect } from 'chai';
import { network } from 'hardhat';
const { ethers } = await network.connect();

describe("Vérification de l'environnement", function () {
	it("Doit confirmer que l'environnement de test tourne sur le fork du Mainnet", async function () {
		// On interroge le provider RPC local pour obtenir le numéro du bloc actuel
		const currentBlock = await ethers.provider.getBlockNumber();

		console.log(`\t📌 Bloc actuel du réseau de test : ${currentBlock}`);

		// L'assertion : on vérifie que le bloc correspond à celui paramétré.
		// S'il renvoie 0 ou un chiffre très faible, c'est que le fork a échoué.
		expect(currentBlock).to.be.greaterThanOrEqual(20000000);
	});
});

describe('Validation du Fork Mainnet', function () {
	// L'adresse USDC mainnet stipulée dans le brief technique
	const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

	// Une "Whale" USDC (ici une adresse réputée très liquide, type Hot Wallet Binance)
	const WHALE_ADDRESS = '0x28C6c06298d514Db089934071355E5743bf21d60';

	it("Doit usurper l'identité d'une baleine et vérifier son solde USDC", async function () {
		// 1. Demander au nœud local Hardhat de déverrouiller l'adresse de la baleine
		await ethers.getImpersonatedSigner(WHALE_ADDRESS);

		// 2. Récupérer le Signer (l'entité capable de signer des transactions pour cette adresse)
		const whaleSigner = await ethers.getSigner(WHALE_ADDRESS);

		// 3. Connecter une interface ERC20 minimale à l'adresse USDC du Mainnet
		// On utilise getContractAt avec un ABI partiel pour aller plus vite
		const usdc = await ethers.getContractAt(
			[
				'function balanceOf(address account) external view returns (uint256)',
				'function decimals() external view returns (uint8)',
			],
			USDC_ADDRESS,
		);

		// 4. Interroger le contrat réel via le fork
		const balance = await usdc.balanceOf(whaleSigner.address);
		const decimals = await usdc.decimals();

		// 5. Formater et afficher le résultat pour la lisibilité
		const formattedBalance = ethers.formatUnits(balance, decimals);
		console.log(
			`\t✅ Solde de la baleine usurpée : ${formattedBalance} USDC`,
		);

		// 6. L'assertion Chai : on s'assure que la baleine possède bien des fonds (> 0)
		// Le 'n' après le 0 indique qu'il s'agit d'un BigInt, format utilisé par Ethers v6
		expect(balance).to.be.greaterThan(0n);
	});
});

// npx hardhat test test/integration/Init.test.ts --network hardhatMainnetFork
