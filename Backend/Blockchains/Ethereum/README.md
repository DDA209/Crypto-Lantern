# 🏮 DeFi Lantern - Smart Contracts (Backend)

Ce dossier contient l'ensemble de la logique on-chain du protocole DeFi Lantern, développé avec **Hardhat** et **Solidity 0.8.28**.

## ⚙️ Architecture des Contrats

Le protocole est construit autour d'une architecture modulaire et sécurisée :

1. **Vault (ERC4626)** : `VaultPrudentGlUSDP.sol` gère les dépôts/retraits en USDC, maintient un _buffer_ de liquidité paramétrable, et émet les parts de coffre (`glUSD-P`).
2. **Adapter (Interface)** : `AaveAdapterUSDC.sol` sert de pont exclusif entre le Vault et le protocole Aave V3.
3. **Sécurité** :
    ### Vulnérabilités Mitigées

-   **Reentrancy (Réentrance) :** Utilisation systématique du modificateur `nonReentrant` (OpenZeppelin) sur les fonctions `deposit()` et `withdraw()` pour empêcher les appels récursifs malveillants.
-   **Insecure Arithmetic (Overflow/Underflow) :** Géré nativement par l'utilisation du compilateur Solidity 0.8.28 qui panique et revert en cas de dépassement.
-   **Force Feeding (Self-Destruct) / Jeton Natif :** Les contrats ne possèdent ni fonction `receive()` ni `fallback()`. Ils rejettent structurellement les dépôts en ETH/POL, évitant de bloquer les fonds. La comptabilité interne se base sur les balances dynamiques (`balanceOf(address(this))`) des ERC20.
-   **tx.origin Authentication :** Le protocole utilise exclusivement `msg.sender` couplé à un contrôle d'accès strict (RBAC) via les modificateurs `onlyDAO`, `onlyTeam`, etc.
-   **Replay Attack :** Le protocole s'appuie sur le nonce de l'EVM pour les transactions standards. Il n'implémente pas de signatures off-chain vulnérables aux rejeux inter-chaines.
-   **Validation des Adapters via ERC165 :** Le contrat `VaultPrudentGlUSDP` exige que tout nouvel adapter ajouté par la DAO vérifie `supportsInterface(type(IAdapter).interfaceId)`. Cela empêche l'injection d'un contrat malveillant ou incompatible dans le tableau des stratégies.

### Risques Restiduels & Acceptés (Contexte de Formation)

-   **Front Running / MEV (Miner Extractable Value) :** Bien que l'utilisation d'Aave protège contre les attaques sandwich classiques des DEX, une attaque par manipulation temporelle sur la fonction `harvest()` reste théoriquement possible.
-   **DoS Block Gas Limit :** La fonction `_rebalance_X1H` boucle sur le tableau `strategies`. Si la DAO ajoute un nombre excessif d'adapters, la transaction pourrait dépasser la limite de gaz du bloc. Une limite arbitraire (`require(strategies.length < MAX_STRATEGIES)`) pourrait être ajoutée dans une V2.
-   **Timestamp Dependence :** Le `deploymentTimestamp` est utilisé à des fins informatives et non pour une logique critique, la manipulation mineure du timestamp par les validateurs n'a donc aucun impact.
-   **Oracle Manipulation :** Le Vault repose sur le peg 1:1 de l'aUSDC fourni par Aave. Une défaillance de l'oracle Aave impacterait indirectement le Vault.

## 🚨 Prévention de l'Attaque par Inflation (ERC4626)

Les Vaults ERC4626 "vides" sont vulnérables à une attaque par manipulation du taux de change (Inflation Attack). Un attaquant peut faire un front-run sur le premier déposant, déposer 1 wei, puis envoyer directement des USDC au contrat pour manipuler artificiellement la valeur de la part, volant ainsi les fonds du déposant légitime.

**Mitigation implémentée lors du déploiement :**
Le script de déploiement doit effectuer obligatoirement un premier dépôt verrouillé (Dead Shares).

```typescript
// Extrait de script de déploiement Hardhat (deploy.ts)
await usdc.approve(vaultAddress, ethers.parseUnits('10', 6));
await vault.deposit(
	// 10 USDC (avec 6 décimales), les jetons glUSDC-P équivalents seront détruits
	ethers.parseUnits('10', 6),
	'0x000000000000000000000000000000000000dEaD',
);

// Extrait de script de déploiement Ignition
const approveCall = m.call(usdc, 'approve', [vault, 10_000_000n], {
	id: 'ApproveUSDCForDeadShares',
});
m.call(
	vault,
	'deposit',
	// 10 USDC (avec 6 décimales), les jetons glUSDC-P équivalents seront détruits
	[10_000_000n, '0x000000000000000000000000000000000000dEaD'],
	{ id: 'MintDeadShares', after: [approveCall] },
);
```

## 🛠️ Prérequis & Installation

Les versions recommandées (Node, Hardhat, Ethers) sont définies dans le fichier `package.json`.

```bash
# 1. Installation
npm install

# 2. Configuration des clés sécurisées (Keystore Hardhat)
npx hardhat vars set PRIVATE_KEY
npx hardhat vars set ALCHEMY_API_KEY
npx hardhat vars set ETHERSCAN_API_KEY

# 3. Compilation et Tests
npx hardhat compile
npx hardhat test

# 4. Déploiement sur Sepolia
npx hardhat ignition deploy ignition/modules/deploy-sepolia.ts --network sepolia --verify --reset

```

🔐 Gestion des Clés (Hardhat Keystore)
Pour des raisons de sécurité, aucune clé privée ni clé d'API n'est stockée dans un fichier .env.
Le projet utilise le système de Keystore natif de Hardhat (vars).

Pour configurer votre environnement avant le déploiement, exécutez :

```
npx hardhat vars set SEPOLIA_RPC_URL
npx hardhat vars set SEPOLIA_PRIVATE_KEY
npx hardhat vars set ETHERSCAN_API_KEY
```

## 🖥️ Déploiement local

Le projet est configuré pour être testé en local et déployé sur le testnet Sepolia pour la soutenance.

```
# Lancer un nœud local (Fork optionnel)
npx hardhat run scripts/deploy-fork.ts --network hardhatMainnetFork

# Déployer sur localhost
npx hardhat run scripts/deploy.ts --network localhost

# Déployer sur Fork local mainnet
npx hardhat run scripts/deploy.ts --network mainnet
```

## 🚀 Déploiement sur Sepolia

Le déploiement sur Sepolia se fait en une seule commande :

```
npx hardhat ignition deploy ignition/modules/deploy-sepolia.ts --network sepolia --verify --reset
```

Le déploiement a été effectué aux adresses suivantes :

```
VaultPrudentGlUSDP : 0xab539bCfbCAf4d7e1A1eb3a79Dbaa6eb6E2aA37F
AaveAdapterUSDC : 0x63854C6147bc1289C4A82878a2EBD51cEddFEe39
```

Sur Etherscan :

-   🔎 [VaultPrudentGlUSDP](https://sepolia.etherscan.io/address/0xab539bCfbCAf4d7e1A1eb3a79Dbaa6eb6E2aA37F#code)
-   🔎 [AaveAdapterUSDC](https://sepolia.etherscan.io/address/0x63854C6147bc1289C4A82878a2EBD51cEddFEe39#code)

Les contrats sont vérifiés sur le block explorer Sepolia :

-   ✅ [VaultPrudentGlUSDP](https://sourcify.dev/server/repo-ui/11155111/0xab539bCfbCAf4d7e1A1eb3a79Dbaa6eb6E2aA37F)
-   ✅ [AaveAdapterUSDC](https://sourcify.dev/server/repo-ui/11155111/0x63854C6147bc1289C4A82878a2EBD51cEddFEe39)

🕵️ [Security Audit](https://solidityscan.com/projects/e71f4082d90cac7d9b62b2ddf1e312b7/a2594fa7c199b305)
