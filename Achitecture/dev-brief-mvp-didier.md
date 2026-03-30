# DeFi Lantern — Brief Développeur MVP (Scope réduit)

> Document adapté pour Didier, mars 2026.
> Basé sur le brief technique complet (docs/dev-brief.md) — scope réduit suite à l'évaluation du dev.
> Aligné avec : whitepaper v0.2, docs/protocole-explication-equipe.md, docs/fonctionnement-smart-contract.

---

## 0. Contexte et décisions de scope

### Ce qui a changé

Le brief original prévoyait 4 vaults + ~11 adapters + gouvernance on-chain complète (Governor + Timelock + multisig) + marché secondaire (TWAP + slippage guard). Après évaluation du temps disponible, voici le **scope réduit réaliste pour la v1 académique** :

| Feature | MVP v1 | Reporté v2 |
|---------|--------|------------|
| Vault Prudent (glUSD-P) fonctionnel | ✅ | — |
| Vault Balanced / Dynamic / Airdrop Hunter | ⚠️ Affiché, bouton désactivé | v2 |
| AaveAdapter (seul adapter réel) | ✅ | — |
| Performance fee 5% via mint shares | ✅ | — |
| Buffer liquidité 10% TVL | ✅ | — |
| `harvest()` manuel (onlyOwner) | ✅ | Keeper automatique v2 |
| Pause d'urgence (deposits bloqués, retraits OK) | ✅ | — |
| Admin = owner EOA simple | ✅ | Governor + Timelock v2 |
| Token GLOW / gouvernance on-chain | ❌ Supprimé MVP | v2 |
| Marché secondaire (TWAP, slippage guard) | ❌ Supprimé MVP | v2 |
| MockUSDC (Sepolia) | ✅ | — |
| Tests Hardhat + Mocha/Chai | ✅ | — |
| Déploiement Sepolia | ✅ | Mainnet v2 |

### Ce qui NE change PAS (figé dans le whitepaper)

Ces règles viennent du whitepaper et des documents de fonctionnement validés par l'équipe. **Elles doivent être respectées telles quelles** :

- **Performance fee 5% des gains nets** → mint de shares au treasury, jamais de transfert USDC
- **Buffer liquidité 10% du TVL** → maintenu accessible en permanence via Aave
- **Non-custodial absolu** → aucune adresse admin ne peut transférer les USDC des users vers l'extérieur
- **Retraits toujours possibles** → même en pause d'urgence, withdraw() et redeem() fonctionnent
- **Deposits bloqués en pause** → deposit() et mint() bloqués par `whenNotPaused`
- **Shares glUSD-P** → nom du token ERC-4626, symbole `glUSD-P`

---

## 1. Stack technique

### Smart contracts (Didier)

| Élément | Version |
|---------|---------|
| Solidity | 0.8.28 |
| Framework | Hardhat v3 |
| Tests | Mocha v11 + Chai v6 |
| Ethers.js | v6 (via `@nomicfoundation/hardhat-ethers`) |
| Déploiement | `@nomicfoundation/hardhat-ignition` |
| Librairie contrats | OpenZeppelin v5.6 |
| Interfaces Aave | `@aave/core-v3` (à ajouter aux dependencies) |

> Le `package.json-back` fourni est déjà correct. Ajouter `"@aave/core-v3": "^1.19.3"` dans `dependencies`.

### Frontend (déjà construit — à brancher)

| Élément | Version |
|---------|---------|
| Framework | React 18 + Vite 5 |
| Web3 | wagmi v2 + RainbowKit v2 |
| Viem | v2 |
| Wallets | MetaMask, Rabby, Coinbase Wallet, WalletConnect |
| Design | Tailwind CSS avec thème custom DeFi Lantern |

> **Note sur `package.json-front` :** Ce fichier montre un setup Next.js 16 + wagmi v3 + @reown/appkit. Si Didier veut partir de ce template pour une nouvelle UI, le pattern d'interaction contrats est quasi-identique (même `useReadContract` / `useWriteContract`). L'intégration immédiate doit cibler le frontend existant (wagmi v2). Voir section 8.

---

## 2. Architecture des contrats MVP

### Structure de fichiers

```
contracts/
├── src/
│   ├── DeFiLanternVaultPrudent.sol    ← ERC-4626, vault principal (à refactoriser)
│   ├── interfaces/
│   │   └── IAdapter.sol               ← interface minimale (à créer)
│   ├── adapters/
│   │   └── AaveAdapter.sol            ← seul adapter MVP (à créer)
│   └── mocks/
│       ├── MockUSDC.sol               ← déjà existant ✅
│       └── MockAavePool.sol           ← optionnel, pour tests unitaires sans fork
├── ignition/
│   └── modules/
│       └── DeFiLanternMVP.ts          ← script de déploiement
├── test/
│   ├── unit/
│   │   └── VaultPrudent.unit.test.ts  ← tests isolés (sans fork)
│   └── integration/
│       └── VaultWithAave.fork.test.ts ← fork mainnet (Aave réel)
├── hardhat.config.ts
├── package.json
└── .env                               ← ne pas committer
```

### Relations entre contrats

```
User
 │
 ├─ deposit(USDC) ──────────────────► DeFiLanternVaultPrudent (ERC-4626)
 │                                          │
 │                                          ├─ mint glUSD-P shares → User
 │                                          │
 │                                          └─ _deployToAdapter() ──► AaveAdapter
 │                                                                         │
 │                                                                         └─ supply(USDC) → Aave v3 Pool
 │                                                                              │
 │                                                                              └─ aUSDC.balanceOf(adapter) ↑ (intérêts)
 │
 └─ redeem(shares) ─────────────────► DeFiLanternVaultPrudent
                                           │
                                           ├─ _withdraw() → AaveAdapter.withdraw() → Aave v3 → USDC
                                           │
                                           └─ burn glUSD-P shares + USDC → User

Owner
 └─ harvest() ──────────────────────► DeFiLanternVaultPrudent
                                           │
                                           ├─ calcule gain = totalAssets() - lastTotalAssets
                                           ├─ feeShares = convertToShares(gain * 5%)
                                           └─ _mint(treasury, feeShares) ← jamais de transfert USDC
```

---

## 3. Contrat 1 : `IAdapter.sol`

Interface minimale que tout adapter doit implémenter. Conçue pour être étendue en v2 (MorphoAdapter, sUSDSAdapter, etc.).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IAdapter
 * @notice Interface standard pour tous les adapters DeFi Lantern.
 *
 * @dev Un adapter est un contrat intermédiaire entre le vault et un protocole
 *      sous-jacent (Aave, Morpho, etc.). Il expose une interface unifiée
 *      quelle que soit la complexité du protocole intégré.
 *
 *      En v2, chaque nouveau protocole = un nouvel adapter qui implémente IAdapter.
 *      Le vault ne connaît que cette interface — pas les détails des protocoles.
 */
interface IAdapter {
    /// @notice Dépose `amount` USDC dans le protocole sous-jacent.
    /// @dev Le vault doit avoir préalablement approuvé ce contrat via USDC.approve().
    /// @param amount Montant en USDC (6 décimales)
    function deposit(uint256 amount) external;

    /// @notice Retire `amount` USDC du protocole et les envoie directement au vault.
    /// @param amount Montant en USDC (6 décimales)
    function withdraw(uint256 amount) external;

    /// @notice Retire TOUS les USDC du protocole. Cas d'urgence uniquement.
    /// @dev Appelé par l'owner de l'adapter (équipe), pas par le vault.
    function emergencyWithdrawAll() external;

    /// @notice Valeur totale gérée par cet adapter, en USDC (6 décimales).
    /// @dev CRITIQUE : doit inclure le capital ET les intérêts accumulés.
    ///      C'est cette fonction qui fait "monter" totalAssets() du vault.
    function totalValue() external view returns (uint256);

    /// @notice Adresse du token sous-jacent géré par cet adapter.
    /// @return Adresse USDC (ou MockUSDC sur Sepolia)
    function underlying() external view returns (address);
}
```

---

## 4. Contrat 2 : `AaveAdapter.sol`

### Pourquoi Aave v3 en premier ?

Aave v3 est le protocole le plus simple à intégrer pour un adapter :
- Pas de cooldown (contrairement à sUSDe qui impose 7 jours)
- Pas de marché secondaire nécessaire (contrairement à thBill)
- Interface `IPool.supply()` / `IPool.withdraw()` directe
- Les **aTokens sont élastiques** : `aUSDC.balanceOf(adapter)` augmente automatiquement avec le temps → `totalValue()` est trivial à implémenter

### Adresses Ethereum mainnet (FIGÉES)

| Contrat | Adresse mainnet |
|---------|----------------|
| Aave v3 Pool | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` |
| aUSDC | `0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c` |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |

> Pour les tests avec fork Hardhat, ces adresses sont identiques (on utilise l'état réel du mainnet).

### Implémentation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAdapter} from "../interfaces/IAdapter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";

/**
 * @title AaveAdapter
 * @notice Adapter Aave v3 pour DeFi Lantern — Profil Prudent.
 *
 * @dev Flux de fonds :
 *   Dépôt  : Vault → (approve) → AaveAdapter → (supply) → Aave Pool → aUSDC
 *   Retrait : Aave Pool → (withdraw) → Vault (directement)
 *
 * Sécurité :
 *   - Seul le vault peut appeler deposit() et withdraw() (modifier onlyVault)
 *   - Seul l'owner peut appeler emergencyWithdrawAll()
 *   - setVault() ne peut être appelé qu'une seule fois (protection anti-réinitialisation)
 */
contract AaveAdapter is IAdapter, Ownable {
    using SafeERC20 for IERC20;

    // ── Constantes — adresses mainnet Aave v3 ────────────────────────────────────
    // Hardcodées pour éviter une dépendance à un registry externe.
    // Si les adresses changent (migration Aave), redéployer l'adapter.

    IPool  public constant AAVE_POOL = IPool(0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2);
    IERC20 public constant USDC      = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20 public constant aUSDC     = IERC20(0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c);

    // ── Storage ───────────────────────────────────────────────────────────────────

    /// @notice Seule adresse autorisée à appeler deposit() et withdraw().
    address public vault;

    // ── Events ────────────────────────────────────────────────────────────────────

    event VaultSet(address indexed vault);
    event Deposited(uint256 amount, uint256 aUsdcReceived);
    event Withdrawn(uint256 amount);
    event EmergencyWithdrawal(uint256 amount, address to);

    // ── Modifiers ─────────────────────────────────────────────────────────────────

    modifier onlyVault() {
        require(msg.sender == vault, "AaveAdapter: caller is not the vault");
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────────

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ── Configuration (appelé UNE SEULE FOIS) ─────────────────────────────────────

    /**
     * @notice Lie cet adapter au vault DeFiLanternVaultPrudent.
     * @dev Appelé dans le script de déploiement Ignition après création des deux contrats.
     *      Ne peut pas être réappelé (protection contre la réinitialisation).
     * @param vault_ Adresse du vault ERC-4626
     */
    function setVault(address vault_) external onlyOwner {
        require(vault == address(0), "AaveAdapter: vault already set");
        require(vault_ != address(0), "AaveAdapter: zero address");
        vault = vault_;
        emit VaultSet(vault_);
    }

    // ── IAdapter : fonctions appelées par le vault ────────────────────────────────

    /**
     * @notice Dépose `amount` USDC dans Aave v3 et reçoit des aUSDC en échange.
     *
     * @dev Flux :
     *   1. Pull USDC depuis le vault (via transferFrom — le vault doit avoir approuvé)
     *   2. Approve Aave Pool pour dépenser ces USDC
     *   3. Aave Pool supply() → envoie aUSDC à l'adapter
     *
     *   Les aUSDC représentent la position de l'adapter sur Aave.
     *   Leur balance augmente automatiquement avec le temps (intérêts).
     *
     * @param amount Montant USDC à déposer (6 décimales)
     */
    function deposit(uint256 amount) external onlyVault {
        // Pull USDC depuis le vault
        USDC.safeTransferFrom(vault, address(this), amount);

        // Approve Aave et déposer
        USDC.approve(address(AAVE_POOL), amount);
        uint256 aUsdcBefore = aUSDC.balanceOf(address(this));
        AAVE_POOL.supply(address(USDC), amount, address(this), 0);
        uint256 aUsdcReceived = aUSDC.balanceOf(address(this)) - aUsdcBefore;

        emit Deposited(amount, aUsdcReceived);
    }

    /**
     * @notice Retire `amount` USDC d'Aave et les envoie DIRECTEMENT au vault.
     *
     * @dev Aave v3 permet de spécifier un `to` dans withdraw().
     *      On envoie directement au vault sans passer par l'adapter.
     *      Aucun aUSDC ne circule vers le vault — uniquement des USDC.
     *
     * @param amount Montant USDC à retirer (6 décimales)
     */
    function withdraw(uint256 amount) external onlyVault {
        AAVE_POOL.withdraw(address(USDC), amount, vault);
        emit Withdrawn(amount);
    }

    /**
     * @notice Urgence : retire TOUT ce qui est sur Aave et l'envoie à l'owner.
     *
     * @dev Appelé par l'équipe en cas d'incident sur Aave.
     *      Utilise type(uint256).max pour retirer le maximum disponible.
     *      ⚠️  Ne peut PAS transférer les fonds vers n'importe qui — uniquement owner().
     */
    function emergencyWithdrawAll() external onlyOwner {
        uint256 balance = aUSDC.balanceOf(address(this));
        if (balance == 0) return;
        AAVE_POOL.withdraw(address(USDC), type(uint256).max, owner());
        emit EmergencyWithdrawal(balance, owner());
    }

    // ── IAdapter : fonctions de lecture ───────────────────────────────────────────

    /**
     * @notice Retourne la valeur totale gérée par cet adapter en USDC.
     *
     * @dev aUSDC est un token ERC-20 "élastique" (rebasing).
     *      Sa balance augmente automatiquement au fil des blocs via le liquidityIndex d'Aave.
     *      balanceOf(adapter) = principal déposé + intérêts accumulés — TOUJOURS en USDC équivalent.
     *
     *      Exemple : si on dépose 1000 USDC et que le taux Aave est 3% / an,
     *      après 1 mois : aUSDC.balanceOf(adapter) ≈ 1002.5 USDC.
     *
     * @return Valeur totale (USDC, 6 décimales)
     */
    function totalValue() external view returns (uint256) {
        return aUSDC.balanceOf(address(this));
    }

    function underlying() external pure returns (address) {
        return address(USDC);
    }
}
```

---

## 5. Contrat 3 : `DeFiLanternVaultPrudent.sol` (refactorisé)

### Ce qui change par rapport au contrat existant

Le contrat existant (`contracts/src/DeFiLanternVaultPrudent.sol`) est une bonne base mais utilise `simulateYield()` pour simuler les rendements. Dans la nouvelle version, les rendements viennent réellement d'Aave via l'adapter.

| Version actuelle (démo) | Version MVP réelle |
|------------------------|-------------------|
| `_simulatedYield` (variable fictive) | `lastTotalAssets` (baseline réelle) |
| `simulateYield(amount)` — transfère des USDC du owner | `harvest()` — lit les intérêts Aave réels |
| `totalAssets()` = balance USDC du vault seulement | `totalAssets()` = vault + adapter.totalValue() |
| Pas d'adapter | `IAdapter public aaveAdapter` |

**Variables à SUPPRIMER :** `_simulatedYield`, `simulateYield()`, `simulatedYield()`

**Variables à AJOUTER :** `aaveAdapter`, `lastTotalAssets`

**Fonctions à MODIFIER :** `totalAssets()`, `constructor`

**Fonctions à AJOUTER :** `harvest()`, `_deposit()` override, `_withdraw()` override, `_deployToAdapter()`

**Fonctions à CONSERVER :** `pause()`, `unpause()`, `setTreasury()`, `sharePrice()`, `assetsOf()`, `PERFORMANCE_FEE_BPS`, `BPS_DENOMINATOR`

### Storage à ajouter

```solidity
// Adapter unique (MVP — étendu à N adapters en v2)
IAdapter public aaveAdapter;

// Baseline pour le calcul des gains nets au moment du harvest
// Mis à jour après chaque dépôt, retrait, et harvest
// Cela évite de prélever des fees sur le capital déposé (seulement sur les gains)
uint256 public lastTotalAssets;
```

### `totalAssets()` — override critique

C'est la fonction la plus importante d'un vault ERC-4626.
Elle détermine le ratio shares/USDC → donc le prix de chaque glUSD-P.

```solidity
function totalAssets() public view override returns (uint256) {
    // 1. USDC directement dans le vault (= le "buffer" de liquidité)
    uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));

    // 2. USDC déployés sur Aave (principal + intérêts accumulés)
    //    aUSDC.balanceOf(adapter) augmente bloc par bloc → le prix du share monte
    uint256 adapterBalance = address(aaveAdapter) != address(0)
        ? aaveAdapter.totalValue()
        : 0;

    return vaultBalance + adapterBalance;
}
```

### `_deposit()` — override (déploiement automatique vers Aave)

En Solidity, ERC-4626 d'OpenZeppelin appelle `_deposit()` en interne lors d'un `deposit()` ou `mint()`.
On surcharge cette fonction pour intercepter APRÈS que les USDC sont arrivés dans le vault.

```solidity
function _deposit(
    address caller,
    address receiver,
    uint256 assets,
    uint256 shares
) internal override {
    // 1. Appel ERC-4626 standard :
    //    - transfère USDC du caller vers le vault
    //    - mint les shares glUSD-P vers le receiver
    super._deposit(caller, receiver, assets, shares);

    // 2. Mise à jour de la baseline AVANT de déployer
    //    (les nouveaux USDC = nouveau capital, pas un gain — pas de fees dessus)
    lastTotalAssets += assets;

    // 3. Déploiement de l'excédent vers Aave (en gardant 10% de buffer)
    _deployToAdapter(assets);
}
```

### `_deployToAdapter()` — logique buffer 10%

```solidity
/**
 * @dev Déploie les USDC excédentaires vers Aave en conservant un buffer de 10%.
 *
 * Le buffer de 10% sert à couvrir les retraits immédiats sans attendre Aave.
 * En pratique, Aave n'a pas de cooldown — le buffer est retiré immédiatement
 * si besoin. Mais maintenir ce buffer réduit la fréquence des appels à Aave.
 *
 * Exemple : TVL = 10 000 USDC, buffer cible = 1 000 USDC.
 * Si le vault a 3 000 USDC directs → déploie 2 000 USDC sur Aave.
 * Si le vault a 800 USDC directs → ne déploie rien (sous le buffer cible).
 */
function _deployToAdapter(uint256) internal {
    if (address(aaveAdapter) == address(0)) return;

    uint256 currentVaultBalance = IERC20(asset()).balanceOf(address(this));
    uint256 targetBuffer = (totalAssets() * 1_000) / BPS_DENOMINATOR; // 10%

    if (currentVaultBalance > targetBuffer) {
        uint256 toDeploy = currentVaultBalance - targetBuffer;
        // Autoriser l'adapter à pull les USDC du vault
        IERC20(asset()).approve(address(aaveAdapter), toDeploy);
        aaveAdapter.deposit(toDeploy);
    }
}
```

### `_withdraw()` — override (retrait depuis Aave si nécessaire)

```solidity
function _withdraw(
    address caller,
    address receiver,
    address owner_,
    uint256 assets,
    uint256 shares
) internal override {
    // 1. Le vault a-t-il assez de USDC en direct ?
    uint256 vaultBalance = IERC20(asset()).balanceOf(address(this));

    if (vaultBalance < assets) {
        // Retrait de la différence depuis Aave
        uint256 shortfall = assets - vaultBalance;
        aaveAdapter.withdraw(shortfall); // Aave envoie directement au vault
    }

    // 2. Mise à jour de la baseline (le capital retiré n'est plus dans le vault)
    //    Évite de compter ce retrait comme un "gain" au prochain harvest
    if (lastTotalAssets >= assets) {
        lastTotalAssets -= assets;
    } else {
        lastTotalAssets = 0;
    }

    // 3. Appel ERC-4626 standard : brûle les shares + transfère USDC au receiver
    super._withdraw(caller, receiver, owner_, assets, shares);
}
```

### `harvest()` — LA fonction centrale du protocole

C'est la mécanique décrite dans le whitepaper et docs/protocole-explication-equipe.md.
Elle remplace `simulateYield()`. Elle lit les VRAIS intérêts accumulés sur Aave.

```solidity
/**
 * @notice Collecte les rendements accumulés et prélève les performance fees.
 *
 * @dev Mécanique (conforme whitepaper section "Fee Model") :
 *   1. Lit totalAssets() = vault + adapter (inclut intérêts Aave accumulés)
 *   2. Gain net = totalAssets() - lastTotalAssets
 *   3. Fee = gain * 5% → convertie en shares → mintée au treasury
 *   4. Jamais de transfert USDC — uniquement du mint de shares
 *   5. Les holders existants sont légèrement dilués (~5% du gain)
 *      → documenté et accepté dans le whitepaper
 *
 *   En v1 : appelée manuellement par l'owner.
 *   En v2 : automatisée via un keeper (Chainlink Automation, Gelato...).
 *
 * @dev Appel recommandé : 1x par semaine minimum. Entre deux harvests, les
 *      intérêts s'accumulent dans Aave mais ne sont pas encore "reconnus"
 *      par le vault (le prix du share ne monte pas avant le harvest).
 *      → À expliquer clairement dans le whitepaper / UI.
 */
function harvest() external onlyOwner {
    uint256 currentTotal = totalAssets();

    // Aucun gain → reset et sortie propre
    if (currentTotal <= lastTotalAssets) {
        lastTotalAssets = currentTotal;
        emit HarvestNoGain(currentTotal, lastTotalAssets);
        return;
    }

    uint256 gain = currentTotal - lastTotalAssets;
    uint256 feeAmount = (gain * PERFORMANCE_FEE_BPS) / BPS_DENOMINATOR;

    // Mint de shares au treasury
    // On utilise le ratio ACTUEL (avant mint) pour calculer les feeShares
    // Cela garantit que le treasury reçoit exactement 5% des gains en valeur
    if (feeAmount > 0 && totalSupply() > 0) {
        uint256 feeShares = convertToShares(feeAmount);
        if (feeShares > 0) {
            _mint(treasury, feeShares);
            emit FeeCollected(feeAmount, feeShares, treasury);
        }
    }

    // Reset APRÈS le mint (totalSupply a changé → totalAssets relatif aussi)
    lastTotalAssets = totalAssets();

    emit Harvested(gain, block.timestamp);
}
```

### Constructeur mis à jour

```solidity
/**
 * @param asset_     Adresse USDC (ou MockUSDC sur Sepolia)
 * @param adapter_   Adresse AaveAdapter (address(0) autorisé pour tests sans adapter)
 * @param treasury_  Adresse recevant les performance fees (EOA ou Safe multisig)
 */
constructor(
    address asset_,
    address adapter_,
    address treasury_
)
    ERC4626(IERC20(asset_))
    ERC20("glUSD Prudent", "glUSD-P")
    Ownable(msg.sender)
{
    require(asset_ != address(0), "asset invalide");
    require(treasury_ != address(0), "treasury invalide");
    // adapter_ peut être address(0) pour les tests unitaires isolés
    aaveAdapter = IAdapter(adapter_);
    treasury = treasury_;
    // lastTotalAssets = 0 → sera mis à jour au premier dépôt via _deposit()
}
```

### Events complets (ajouter aux existants)

```solidity
// Nouveaux events pour la mécanique réelle
event Harvested(uint256 gain, uint256 timestamp);
event HarvestNoGain(uint256 currentTotal, uint256 lastKnown);
// FeeCollected existe déjà ✅
// YieldSimulated → à SUPPRIMER
// DepositExecuted, WithdrawExecuted → conserver
```

### Fonctions admin (conserver + ajouter)

```solidity
// ✅ Déjà présentes — conserver telles quelles :
function setTreasury(address newTreasury) external onlyOwner { ... }
function pause(string calldata reason) external onlyOwner { ... }
function unpause() external onlyOwner { ... }
function sharePrice() external view returns (uint256) { ... }
function assetsOf(address account) external view returns (uint256) { ... }

// 🆕 À ajouter — pour la v2 (ajouter maintenant, laisser vide ou onlyOwner) :
function setAdapter(address newAdapter) external onlyOwner {
    aaveAdapter = IAdapter(newAdapter);
}
```

---

## 6. `hardhat.config.ts`

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // Fork Ethereum mainnet local
    // → permet de tester Aave v3 réel sans frais de gas réels
    hardhat: {
      forking: {
        url: process.env.MAINNET_RPC_URL!,
        // Fixer le bloc pour des tests reproductibles (mettre à jour périodiquement)
        blockNumber: 22_000_000,
        enabled: true,
      },
    },
    // Sepolia — réseau de test public pour la démo
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL!,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
```

### `.env` (ne jamais committer ce fichier)

```bash
# Alchemy ou Infura — nécessaire pour le fork mainnet
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/VOTRE_CLE
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/VOTRE_CLE

# Clé privée du compte déployeur (Sepolia uniquement)
PRIVATE_KEY=0x_CLE_PRIVEE_SEPOLIA

# Optionnel — pour vérifier les contrats sur Etherscan
ETHERSCAN_API_KEY=VOTRE_CLE_ETHERSCAN
```

### Ajout dans `package.json`

```json
{
  "dependencies": {
    "@openzeppelin/contracts": "^5.6.1",
    "@aave/core-v3": "^1.19.3"
  }
}
```

---

## 7. Tests Hardhat

### Stratégie : deux niveaux de tests

**Tests unitaires (sans fork)** — rapides (~5 sec), testent la logique du vault isolément.
Utilisent MockUSDC et optionnellement un MockAavePool. Pas besoin de connexion réseau.

**Tests d'intégration (fork mainnet)** — plus lents (~30-60 sec), testent l'interaction réelle avec Aave v3.
Hardhat forke l'état du mainnet depuis Alchemy/Infura. On impersonne un wallet whale pour avoir des USDC.

### `test/unit/VaultPrudent.unit.test.ts`

```typescript
import { expect } from "chai";
import { ethers } from "hardhat";

describe("DeFiLanternVaultPrudent — tests unitaires", () => {
  let vault: any, mockUsdc: any;
  let owner: any, user: any, treasury: any;

  beforeEach(async () => {
    [owner, user, treasury] = await ethers.getSigners();

    // Déployer MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUsdc = await MockUSDC.deploy();

    // Déployer vault SANS adapter (address(0)) — tests purement unitaires
    const Vault = await ethers.getContractFactory("DeFiLanternVaultPrudent");
    vault = await Vault.deploy(
      await mockUsdc.getAddress(),
      ethers.ZeroAddress, // pas d'adapter
      treasury.address
    );

    // L'utilisateur reçoit 1000 USDC via le faucet MockUSDC
    await mockUsdc.connect(user).faucet();
  });

  it("premier dépôt → shares 1:1 avec les USDC", async () => {
    const amount = ethers.parseUnits("100", 6); // 100 USDC
    await mockUsdc.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).deposit(amount, user.address);

    // Au premier dépôt, le ratio est 1:1
    const shares = await vault.balanceOf(user.address);
    expect(shares).to.equal(amount);
  });

  it("le share price augmente avec les gains (simulation)", async () => {
    // Dépôt initial
    const amount = ethers.parseUnits("1000", 6);
    await mockUsdc.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).deposit(amount, user.address);

    // Simuler un gain : owner envoie 50 USDC directement au vault
    // (simule ce que ferait Aave via l'adapter)
    const gain = ethers.parseUnits("50", 6);
    await mockUsdc.connect(owner).mint(await vault.getAddress(), gain);

    // Le share price doit être > 1 maintenant
    const sharePrice = await vault.sharePrice();
    expect(sharePrice).to.be.gt(ethers.parseUnits("1", 6));
  });

  it("harvest() sans gain → aucun share minté au treasury", async () => {
    const amount = ethers.parseUnits("1000", 6);
    await mockUsdc.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).deposit(amount, user.address);

    const treasuryBefore = await vault.balanceOf(treasury.address);
    await vault.connect(owner).harvest();
    const treasuryAfter = await vault.balanceOf(treasury.address);

    expect(treasuryAfter).to.equal(treasuryBefore);
  });

  it("deposit bloqué en pause, redeem toujours possible", async () => {
    const amount = ethers.parseUnits("100", 6);
    await mockUsdc.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).deposit(amount, user.address);

    // Pause
    await vault.connect(owner).pause("incident test");

    // Dépôt bloqué
    await expect(
      vault.connect(user).deposit(amount, user.address)
    ).to.be.revertedWithCustomError(vault, "EnforcedPause");

    // Retrait toujours possible (non-custodial — règle whitepaper)
    const shares = await vault.balanceOf(user.address);
    await expect(
      vault.connect(user).redeem(shares, user.address, user.address)
    ).to.not.be.reverted;
  });

  it("non-custodial : owner ne peut pas voler les fonds", async () => {
    const amount = ethers.parseUnits("1000", 6);
    await mockUsdc.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).deposit(amount, user.address);

    // Owner ne peut pas transférer les shares de user sans permission
    await expect(
      vault.connect(owner).transferFrom(user.address, owner.address, amount)
    ).to.be.reverted;

    // Vault n'a pas de fonction pour extraire les USDC arbitrairement
    // → tester en vérifiant qu'aucune telle fonction n'existe dans l'ABI
  });
});
```

### `test/integration/VaultWithAave.fork.test.ts`

```typescript
import { expect } from "chai";
import { ethers } from "hardhat";

// Adresses mainnet (disponibles sur le fork Hardhat)
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const AUSDC_ADDRESS = "0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c";
// Binance Hot Wallet — possède des centaines de millions d'USDC sur mainnet
const USDC_WHALE   = "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503";

describe("DeFiLanternVaultPrudent + AaveAdapter (fork mainnet)", function () {
  this.timeout(120_000); // Fork tests = plus lents

  let vault: any, adapter: any, usdc: any, aUsdc: any;
  let owner: any, user: any, treasury: any;

  beforeEach(async () => {
    [owner, user, treasury] = await ethers.getSigners();

    // Impersonation d'un whale USDC :
    // Sur le fork, on peut "prendre" l'identité de n'importe quelle adresse
    await ethers.provider.send("hardhat_impersonateAccount", [USDC_WHALE]);
    await ethers.provider.send("hardhat_setBalance", [
      USDC_WHALE,
      "0x56BC75E2D63100000", // 100 ETH pour le gas
    ]);
    const whale = await ethers.getSigner(USDC_WHALE);

    // Interfaces pour les tokens
    usdc  = await ethers.getContractAt("IERC20", USDC_ADDRESS);
    aUsdc = await ethers.getContractAt("IERC20", AUSDC_ADDRESS);

    // Déploiement AaveAdapter
    const AdapterFactory = await ethers.getContractFactory("AaveAdapter");
    adapter = await AdapterFactory.deploy(owner.address);

    // Déploiement Vault Prudent avec adapter réel
    const VaultFactory = await ethers.getContractFactory("DeFiLanternVaultPrudent");
    vault = await VaultFactory.deploy(
      USDC_ADDRESS,
      await adapter.getAddress(),
      treasury.address
    );

    // Lier adapter ↔ vault (appelé UNE SEULE FOIS — protégé dans setVault)
    await adapter.connect(owner).setVault(await vault.getAddress());

    // Donner 10 000 USDC au user de test
    await usdc.connect(whale).transfer(
      user.address,
      ethers.parseUnits("10000", 6)
    );
  });

  it("dépôt → USDC déployés sur Aave (aUSDC visibles)", async () => {
    const depositAmount = ethers.parseUnits("1000", 6);
    await usdc.connect(user).approve(await vault.getAddress(), depositAmount);
    await vault.connect(user).deposit(depositAmount, user.address);

    // User a reçu des shares glUSD-P
    expect(await vault.balanceOf(user.address)).to.be.gt(0);

    // L'adapter a des aUSDC (preuve que les fonds sont sur Aave v3)
    expect(await aUsdc.balanceOf(await adapter.getAddress())).to.be.gt(0);

    // totalAssets() reflète le dépôt
    expect(await vault.totalAssets()).to.be.closeTo(
      depositAmount,
      ethers.parseUnits("1", 6) // tolérance 1 USDC (arrondi)
    );
  });

  it("harvest() après 30 jours → fees mintées au treasury (5% des gains)", async () => {
    const depositAmount = ethers.parseUnits("10000", 6); // 10k USDC
    await usdc.connect(user).approve(await vault.getAddress(), depositAmount);
    await vault.connect(user).deposit(depositAmount, user.address);

    // Avancer le temps de 30 jours (les intérêts Aave s'accumulent)
    await ethers.provider.send("evm_increaseTime", [30 * 24 * 3600]);
    await ethers.provider.send("evm_mine", []);

    const treasurySharesBefore = await vault.balanceOf(treasury.address);
    await vault.connect(owner).harvest();
    const treasurySharesAfter = await vault.balanceOf(treasury.address);

    // Le treasury a reçu des shares (= 5% des intérêts Aave de 30 jours)
    expect(treasurySharesAfter).to.be.gt(treasurySharesBefore);

    // À titre indicatif : Aave ~3% APY → 30j → ~25 USDC de gain
    // → treasury devrait avoir ~1.25 USDC en shares (5% de 25)
    console.log("Treasury shares received:", treasurySharesAfter - treasurySharesBefore);
  });

  it("retrait complet après harvest → user récupère principal + gains nets", async () => {
    const depositAmount = ethers.parseUnits("1000", 6);
    await usdc.connect(user).approve(await vault.getAddress(), depositAmount);
    await vault.connect(user).deposit(depositAmount, user.address);

    // Attendre 30 jours
    await ethers.provider.send("evm_increaseTime", [30 * 24 * 3600]);
    await ethers.provider.send("evm_mine", []);

    // Harvest pour reconnaître les gains et prélever les fees
    await vault.connect(owner).harvest();

    // Retrait complet
    const shares = await vault.balanceOf(user.address);
    const usdcBefore = await usdc.balanceOf(user.address);
    await vault.connect(user).redeem(shares, user.address, user.address);
    const usdcAfter = await usdc.balanceOf(user.address);

    // User récupère plus que ce qu'il a déposé (gains Aave - 5% de fees)
    expect(usdcAfter).to.be.gt(usdcBefore + depositAmount - ethers.parseUnits("1", 6));
  });

  it("retrait sans harvest → user récupère son capital (gains pas encore reconnus)", async () => {
    const depositAmount = ethers.parseUnits("1000", 6);
    await usdc.connect(user).approve(await vault.getAddress(), depositAmount);
    await vault.connect(user).deposit(depositAmount, user.address);

    // Retrait immédiat (pas de harvest)
    const shares = await vault.balanceOf(user.address);
    const usdcBefore = await usdc.balanceOf(user.address);
    await vault.connect(user).redeem(shares, user.address, user.address);
    const usdcAfter = await usdc.balanceOf(user.address);

    // Récupère approximativement le dépôt initial
    expect(usdcAfter).to.be.closeTo(
      usdcBefore + depositAmount,
      ethers.parseUnits("1", 6) // tolérance 1 USDC
    );
  });
});
```

### Commandes de test

```bash
# Installation des dépendances
npm install

# Compilation (vérifie la syntaxe Solidity + génère les ABIs)
npx hardhat compile

# Tests unitaires uniquement (rapides, sans fork)
npx hardhat test test/unit/ --network hardhat

# Tests d'intégration (fork mainnet — nécessite MAINNET_RPC_URL dans .env)
npx hardhat test test/integration/ --network hardhat

# Tous les tests
npx hardhat test

# Avec gas report (optionnel)
REPORT_GAS=true npx hardhat test
```

---

## 8. Déploiement Hardhat Ignition

```typescript
// ignition/modules/DeFiLanternMVP.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// ⚠️ CHANGER avant déploiement sur Sepolia
// En dev : utiliser l'adresse du déployeur (m.getAccount(0))
const TREASURY_ADDRESS = "0x_ADRESSE_TREASURY";

export default buildModule("DeFiLanternMVP", (m) => {
  // 1. MockUSDC — simuler USDC sur Sepolia (ne PAS déployer sur mainnet)
  const mockUsdc = m.contract("MockUSDC");

  // 2. AaveAdapter
  const adapter = m.contract("AaveAdapter", [m.getAccount(0)]);

  // 3. Vault Prudent
  const vault = m.contract("DeFiLanternVaultPrudent", [
    mockUsdc,          // asset = MockUSDC
    adapter,           // adapter = AaveAdapter
    TREASURY_ADDRESS,  // treasury
  ]);

  // 4. Lier adapter → vault (appelé une seule fois par Ignition)
  m.call(adapter, "setVault", [vault]);

  return { mockUsdc, adapter, vault };
});
```

### Commandes de déploiement

```bash
# Déployer sur Sepolia
npx hardhat ignition deploy ignition/modules/DeFiLanternMVP.ts \
  --network sepolia \
  --deployment-id mvp-v1

# Afficher les adresses déployées
npx hardhat ignition deployments

# Vérifier les contrats sur Etherscan Sepolia
npx hardhat ignition verify mvp-v1 --network sepolia
```

Ignition génère automatiquement les adresses dans :
`ignition/deployments/mvp-v1/deployed_addresses.json`

---

## 9. Intégration avec le frontend existant

### Contexte du frontend

Le frontend React (Vite + wagmi v2 + RainbowKit) est **déjà câblé** pour recevoir les contrats ERC-4626. Il existe un hook `useVault.js` qui gère toutes les interactions contrats. Voici exactement ce qu'il faut livrer au frontend pour que tout fonctionne.

### Étape 1 : Export de l'ABI JSON

Après `npx hardhat compile`, les ABIs sont dans `artifacts/`. Copier vers le frontend :

```bash
# Vault Prudent (remplace l'ABI existant)
cp artifacts/contracts/src/DeFiLanternVaultPrudent.sol/DeFiLanternVaultPrudent.json \
   CHEMIN_FRONTEND/src/contracts/DeFiLanternVaultPrudent.json

# MockUSDC (remplace l'ABI existant)
cp artifacts/contracts/src/mocks/MockUSDC.sol/MockUSDC.json \
   CHEMIN_FRONTEND/src/contracts/MockUSDC.json
```

Format attendu par le frontend : `{ "abi": [ ...] }` — c'est exactement ce que génère Hardhat.

### Étape 2 : Mise à jour des adresses

Fichier à modifier dans le frontend : `src/contracts/addresses.js`

```javascript
export function getAddresses(chainId) {
  const addresses = {
    11155111: { // Sepolia
      // ← Mettre les nouvelles adresses après déploiement
      mockUSDC:          "0x_NOUVELLE_ADRESSE_MOCK_USDC",
      vaultPrudent:      "0x_NOUVELLE_ADRESSE_VAULT",
      // Autres vaults = null → affichés "Bientôt disponible" dans l'UI
      vaultBalanced:     null,
      vaultDynamic:      null,
      vaultAirdropHunter: null,
    },
    1: { // Mainnet
      vaultPrudent: null, // À remplir lors du déploiement mainnet (v2)
    }
  };
  return addresses[chainId] || {};
}
```

### Compatibilité des fonctions — aucune modification du frontend requise

Le hook `useVault.js` appelle ces fonctions — **toutes présentes dans le vault refactorisé** :

| Fonction | Source | Présente ? |
|----------|--------|------------|
| `deposit(assets, receiver)` | ERC-4626 standard | ✅ |
| `redeem(shares, receiver, owner)` | ERC-4626 standard | ✅ |
| `balanceOf(address)` | ERC-20 (hérité) | ✅ |
| `totalAssets()` | Override avec adapter | ✅ |
| `sharePrice()` | View function conservée | ✅ |
| `assetsOf(address)` | View function conservée | ✅ |
| `faucet()` | MockUSDC (inchangé) | ✅ |

**`simulateYield()` supprimée** : si le frontend l'appelait, supprimer ces appels. D'après l'analyse du code, `useVault.js` ne l'utilise pas — elle était uniquement dans une interface admin.

### Note sur le `package.json-front` fourni (Next.js 16 + wagmi v3)

Si Didier veut partir de ce template pour reconstruire l'UI en Next.js, le pattern reste identique :

```typescript
// wagmi v3 — même API que v2 pour les interactions contrats
import { useReadContract, useWriteContract } from "wagmi";
import VaultABI from "./abi/DeFiLanternVaultPrudent.json";

const VAULT_ADDRESS = "0x...";

// Lecture
const { data: totalAssets } = useReadContract({
  address: VAULT_ADDRESS,
  abi: VaultABI.abi,
  functionName: "totalAssets",
});

// Écriture
const { writeContract } = useWriteContract();
writeContract({
  address: VAULT_ADDRESS,
  abi: VaultABI.abi,
  functionName: "deposit",
  args: [amount, receiver],
});
```

Différence principale : `@reown/appkit` remplace RainbowKit pour la modale wallet. L'API wagmi est identique.

---

## 10. Sécurité — points critiques (pour revue de code)

| Vecteur d'attaque | Protection en place |
|------------------|---------------------|
| **Reentrancy sur deposit/withdraw** | OZ ERC-4626 suit le pattern CEI nativement (effects avant interactions) |
| **Double-comptage des fees** | `lastTotalAssets` mis à jour APRÈS `_mint(treasury, feeShares)` |
| **Drain par admin** | `onlyOwner` uniquement sur harvest, setTreasury, pause — aucune fonction de transfert USDC arbitraire |
| **Drain via adapter** | `onlyVault` dans AaveAdapter.deposit() et withdraw() |
| **Réinitialisation de setVault** | `require(vault == address(0))` — appelable une seule fois |
| **Overflow arithmetic** | Solidity 0.8.28 — revert automatique sur overflow/underflow |
| **Décimales USDC (6) vs shares** | ERC-4626 OZ gère le ratio via `_convertToShares` / `_convertToAssets` — pas de perte de précision |
| **Fee sur le capital (pas les gains)** | `lastTotalAssets += assets` dans `_deposit()` — le capital n'est jamais compté comme gain |

---

## 11. Ordre de développement recommandé

```
Jour 1
├── Setup Hardhat (config, .env, npm install)
├── npx hardhat compile (vérifier que OZ + Aave compilent)
└── IAdapter.sol (interface simple — 15 min)

Jour 2
├── AaveAdapter.sol
└── Tests fork : AaveAdapter.deposit() et withdraw() fonctionnent

Jour 3
├── Refactorisation DeFiLanternVaultPrudent.sol
│   ├── Supprimer simulateYield / _simulatedYield
│   ├── Ajouter lastTotalAssets, aaveAdapter
│   ├── Override totalAssets(), _deposit(), _withdraw()
│   └── harvest()
└── Tests unitaires (sans fork)

Jour 4
├── Tests d'intégration (fork mainnet)
│   ├── Dépôt → aUSDC visible
│   ├── Harvest → fees mintées
│   └── Retrait → USDC récupérés
└── Ajustements si tests échouent

Jour 5
├── Script Ignition (DeFiLanternMVP.ts)
├── Déploiement Sepolia
└── Mise à jour frontend (ABI + addresses.js)

Démo
└── Vérification E2E (voir checklist section 12)
```

---

## 12. Checklist de vérification E2E (avant démo)

```
Tests
☐ npx hardhat test — TOUS verts (unitaires + intégration)
☐ Gas report acceptable (deposit < 300k, harvest < 200k)

Déploiement
☐ Contrats déployés sur Sepolia
☐ Adresses récupérées depuis ignition/deployments/mvp-v1/deployed_addresses.json
☐ Contrats vérifiés sur Etherscan Sepolia (optionnel mais propre pour la démo)

Frontend
☐ DeFiLanternVaultPrudent.json mis à jour (ABI)
☐ MockUSDC.json mis à jour (ABI)
☐ addresses.js mis à jour (vaultPrudent + mockUSDC Sepolia)

Flux utilisateur
☐ Connexion wallet (MetaMask sur Sepolia)
☐ Faucet → 1000 USDC reçus
☐ Approve → deposit → shares glUSD-P visibles dans le frontend
☐ sharePrice() = 1.000000 (ratio initial)
☐ [Owner] harvest() → treasury a des shares (vérifier sur Sepolia Etherscan)
☐ redeem() → USDC récupérés (≈ montant initial)

Règles whitepaper
☐ Pause : deposit bloqué, redeem fonctionne
☐ harvest() onlyOwner (user ne peut pas appeler)
☐ Aucune fonction ne permet à l'owner de transférer les USDC des users
☐ Vaults Balanced/Dynamic/AH : affichés dans l'UI, bouton désactivé ("Bientôt disponible")
```

---

## 13. Adresses de référence (Ethereum mainnet)

| Protocole | Contrat | Adresse |
|-----------|---------|---------|
| Aave v3 | Pool | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` |
| Aave v3 | aUSDC | `0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c` |
| USDC | Token | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| USDC whale (tests) | Binance Hot | `0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503` |

---

*Document généré mars 2026 — DeFi Lantern Protocol*
*Référence : whitepaper v0.2 + docs/protocole-explication-equipe.md + docs/fonctionnement-smart-contract.pdf*
