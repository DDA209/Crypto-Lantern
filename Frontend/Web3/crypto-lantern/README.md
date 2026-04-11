# 🏮 DeFi Lantern - Interface Web3 (Frontend)

Ce dossier contient l'application décentralisée (DApp) permettant d'interagir avec les contrats DeFi Lantern. Elle est conçue pour séparer strictement les rôles : Investisseurs, Team (Technique) et DAO (Gouvernance).

## 💻 Technologies Utilisées

- **Framework & Rendu :** Next.js (App Router) exploitant le SSR (Server-Side Rendering) et les composants clients conditionnels (`mounted` pattern) pour éviter les erreurs d'hydratation liées aux états asynchrones du portefeuille.
- **Intégration Web3 (Wagmi / Viem) :**
    - Connexion de portefeuilles via WalletConnect / Reown.
    - Optimisation des appels RPC : Utilisation experte de `useReadContracts` (Multicall) pour regrouper les requêtes on-chain (TotalAssets, TotalSupply, Adresses de gouvernance) en une seule requête, réduisant drastiquement le trafic réseau et les risques de _DoS Unexpected Error_ côté provider RPC.
- **Analyse On-Chain (Events) :** Extraction et formatage des logs d'événements Solidity (ex: `event Harvest(...)`) via `publicClient.getLogs` pour reconstituer l'historique financier sans dépendre d'une base de données centralisée.
- **UI/UX & Accessibilité :**
    - Interface construite avec Tailwind CSS et shadcn/ui.
    - Support multilingue natif (i18n).
    - Gestion rigoureuse des états de transaction (Loading, Success, Error) avec `sonner` (Toast notifications) pour un feedback utilisateur optimal lors des appels de contrats de longue durée.

## 🎯 Fonctionnalités Clés

- **Portail Investisseur :** Interface fluide pour déposer/retirer des USDC et consulter l'APY.
- **Dashboard Public :** Exposition des métriques vitales on-chain (AUM, Total Supply, Buffer, Prix de la part).
- **Administration Team :** Interface sécurisée permettant de déclencher le `harvest()` et d'afficher les logs financiers récupérés directement depuis les événements Solidity.
- **Gouvernance DAO :** Formulaire dynamique permettant de redéfinir les stratégies (Adapters) avec conversion automatique en BIPS et sécurité anti-revert (somme strictement égale à 100%).

## 🛠️ Installation & Démarrage

Les versions de Node et des dépendances à utiliser sont définies dans le `package.json`.

```Shell
# 1. Installation
npm install

# 2. Lancement du serveur de développement
npm run dev
```

🔐 Variables d'Environnement (.env.local)
Créez un fichier .env.local à la racine de ce dossier avec la configuration suivante (réseaux Local et Sepolia actifs pour le projet) :

```Dotenv
NEXT_PUBLIC_USDC_ADDRESS_HARDHAT='0x5FbDB2315678afecb367f032d93F642f64180aa3'
NEXT_PUBLIC_VAULT_PRUDENT_GLUSDP_ADDRESS_HARDHAT='0x----------------------------------------'
NEXT_PUBLIC_BLOCK_NUMBER_HARDHAT=0
RPC_URL_HARDHAT='http://127.0.0.1:8545/'

NEXT_PUBLIC_USDC_ADDRESS_SEPOLIA='0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8'
NEXT_PUBLIC_VAULT_PRUDENT_GLUSDP_ADDRESS_SEPOLIA='0x----------------------------------------'
NEXT_PUBLIC_BLOCK_NUMBER_SEPOLIA=10000000
RPC_URL_SEPOLIA='https://sepolia.infura.io/v3/--------------------------------'

NEXT_PUBLIC_USDC_ADDRESS_MAINNET='0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
NEXT_PUBLIC_VAULT_PRUDENT_GLUSDP_ADDRESS_MAINNET=''
NEXT_PUBLIC_BLOCK_NUMBER_LOCAL_MAINNET=24000000
RPC_URL_MAINNET='https://mainnet.infura.io/v3/--------------------------------'

NEXT_PUBLIC_PROJECT_ID='--------------------------------'
```
