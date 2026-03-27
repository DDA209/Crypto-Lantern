# DeFi Lantern — Brief Technique Développeur

> Document de référence pour l'implémentation des smart contracts.
> Synthèse des trois documents internes (protocole, gouvernance, marché secondaire) + whitepaper v0.2
> Dernière mise à jour : mars 2026 — v2.0

---

## 0. Résumé exécutif

**Ce que le protocole fait :** L'utilisateur dépose USDC → reçoit des shares glUSD (ERC-4626) → ses USDC sont déployés sur N protocoles lors du harvest → les rendements font monter le prix du share → au retrait, il brûle ses shares et récupère USDC + rendements.

**Ce que le code doit implémenter :**
- 4 vaults ERC-4626 (Prudent / Balanced / Dynamic / Airdrop Hunter)
- N adapters (un par protocole sous-jacent), tous derrière `IAdapter`
- Harvest manuel (v1) : calcul des gains, fee accrual, rebalancing conditionnel
- Retrait : buffer Aave v3 → exit proportionnel si besoin
- Marché secondaire : TWAP + slippage guard pour thBILL / stcUSD / sUSDe
- Gouvernance : OZ Governor + TimelockController + Guardian multisig 2/3

**Règles non-négociables (figées dans le whitepaper) :**
- Performance fee 5% → mint de shares au treasury, jamais de transfert USDC
- Buffer liquidité 10% TVL sur Aave v3, en permanence
- Rebalancing déclenché seulement si dérive > 5% relatif par adapter
- Guardian ne peut que `pause()` + `emergencyExit(adapter)` — jamais toucher les fonds
- Non-custodial absolu : aucune adresse admin ne peut transférer les USDC des users vers l'extérieur

---

## 1. Stack & Standards

| Élément | Valeur |
|---------|--------|
| Solidity | 0.8.x |
| Framework | Foundry (tests + fork mainnet) |
| Librairies | OpenZeppelin v5 |
| Standard vault | ERC-4626 |
| Chain | Ethereum mainnet (tests : Sepolia + fork ETH mainnet) |
| Oracle prix | TWAP Uniswap V3 (30 min) pour les protocoles marché secondaire |
| MEV protection | Flashbots MEV Protect (mempool privé) pour les swaps |

---

## 2. Trois architectures proposées

### Architecture A — Vaults 100% indépendants

Chaque vault est un contrat autonome qui embarque toute sa logique. Pas de partage de code.

```
DeFiLanternVaultPrudent.sol    (toute la logique Prudent inline)
DeFiLanternVaultBalanced.sol   (toute la logique Balanced inline)
DeFiLanternVaultDynamic.sol    (toute la logique Dynamic inline)
DeFiLanternVaultAirdropHunter.sol
```

**Avantages :**
- Le code le plus simple à lire (zéro abstraction)
- Un bug dans Prudent n'affecte pas les autres vaults
- Déploiement trivial (pas de dépendance entre contrats)

**Inconvénients :**
- Duplication massive (~80% du code est identique : harvest, fee accrual, retrait, exit proportionnel)
- 4× plus d'audits à faire → 4× plus de surface d'attaque
- Corriger un bug implique de modifier et redeployer 4 contrats

**Verdict : ❌ Non recommandée pour ce projet.** La duplication annule les bénéfices de simplicité.

---

### Architecture B — Base vault + héritage (RECOMMANDÉE)

Un contrat `BaseLanternVault.sol` contient toute la logique commune (harvest, fees, rebalancing, retrait, pause...). Les 4 vaults héritent de cette base et ne surchargent que ce qui est spécifique (nom, symbole, liste initiale d'adapters).

```
contracts/
├── vaults/
│   ├── BaseLanternVault.sol              ← ERC-4626 + logique commune (harvest, fees, retrait)
│   ├── DeFiLanternVaultPrudent.sol       ← hérite BaseLanternVault, configure 10 adapters Prudent
│   ├── DeFiLanternVaultBalanced.sol      ← hérite BaseLanternVault, configure 20 adapters Balanced
│   ├── DeFiLanternVaultDynamic.sol       ← hérite BaseLanternVault, configure 10 adapters Dynamic
│   └── DeFiLanternVaultAirdropHunter.sol ← hérite BaseLanternVault, configure 4 adapters AH
├── interfaces/
│   ├── IAdapter.sol                       ← interface standard
│   └── ISecondaryMarketAdapter.sol        ← extension pour les adapters à marché secondaire
├── adapters/
│   ├── BaseAdapter.sol                    ← logique commune aux adapters (ownable, vault-only)
│   ├── SecondaryMarketAdapter.sol         ← base abstraite : TWAP, slippage, impact, Flashbots
│   ├── AaveAdapter.sol
│   ├── MorphoAdapter.sol
│   ├── [... autres adapters ...]
│   ├── thBillAdapter.sol                  ← hérite SecondaryMarketAdapter
│   └── CapAdapter.sol                     ← hérite SecondaryMarketAdapter
├── governance/
│   ├── GlowToken.sol
│   ├── DeFiLanternGovernor.sol
│   └── TimelockController.sol
└── utils/
    └── FeeManager.sol
```

**Avantages :**
- Un seul endroit pour corriger un bug dans le harvest → corrigé pour tous les vaults
- Audit d'un seul `BaseLanternVault` couvre les 4 profils
- Conforme au pattern standard OpenZeppelin (ERC4626 est déjà conçu pour l'héritage)
- Balanced = 50% adapters Prudent + 50% adapters Dynamic → pas de logique spéciale, même base

**Inconvénients :**
- Un bug dans `BaseLanternVault` impacte les 4 vaults simultanément → **tests exhaustifs obligatoires**
- La hiérarchie d'héritage peut être difficile à naviguer si elle devient trop profonde (→ garder max 2 niveaux)
- Nécessite `virtual/override` proprement géré (Solidity peut être piégeux sur le linearization order)

**Verdict : ✅ Recommandée.** C'est l'approche standard de l'écosystème (Yearn v3, Morpho Vaults, 4626 Alliance).

---

### Architecture C — Factory + Minimal Proxy (ERC-1167)

Un seul contrat d'implémentation vault déployé une fois. La Factory déploie des proxies légers (clones) qui délèguent tous les appels à l'implémentation via `delegatecall`. Chaque vault est un proxy + son propre storage.

```
VaultImplementation.sol   ← implémentation unique (logique)
LanternVaultFactory.sol   ← deploy des clones ERC-1167
Clone Proxy Prudent        ← stocke son propre state, délègue la logique
Clone Proxy Balanced       ← même chose
Clone Proxy Dynamic        ← même chose
Clone Proxy AirdropHunter  ← même chose
```

**Avantages :**
- Déploiement beaucoup moins cher (~45k gas par clone vs ~2M gas par vault complet)
- Utile si on veut permettre à d'autres équipes de déployer leurs propres vaults
- Un seul bytecode à auditer

**Inconvénients :**
- Complexité ajoutée pour un bénéfice faible à 4 vaults fixes (les économies de gas sont marginales)
- Les proxies minimal (ERC-1167) ne sont **pas upgradables** — si on veut upgradabilité, il faut Transparent Proxy ou UUPS, ce qui ajoute encore plus de complexité
- Le `delegatecall` rend les bugs de storage layout catastrophiques → risque élevé pour un débutant
- Interaction entre `initializer` et ERC-4626 peut causer des problèmes subtils (reentrancy, double-init)

**Verdict : ❌ Non recommandée pour la v1.** Complexité injustifiée pour 4 vaults fixes. Envisageable en v2 si on ouvre la création de vaults à d'autres équipes.

---

### Tableau comparatif

| Critère | A — Indépendant | B — Héritage ✅ | C — Proxy Factory |
|---------|-----------------|----------------|-------------------|
| Complexité code | Faible (mais répétitif) | Moyenne | Élevée |
| Duplication | Maximale | Minimale | Minimale |
| Surface d'audit | Maximale (4×) | Faible (1 base) | Faible (1 implem) |
| Risque de blast radius | Isolé par vault | Tous vaults si bug base | Tous vaults si bug implem |
| Gas déploiement | Standard | Standard | Minimal (clones) |
| Upgradabilité | Non | Non | Avec UUPS seulement |
| Adapté débutant | ✅ | ✅ | ❌ |
| Standard industriel | Non | ✅ Oui | Partiel |

---

## 3. Design détaillé — Architecture B (recommandée)

### 3.1 `BaseLanternVault.sol`

C'est le cœur du protocole. Il hérite d'`ERC4626` d'OpenZeppelin et ajoute :

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

abstract contract BaseLanternVault is ERC4626, AccessControl, Pausable {

    // ─── RÔLES ────────────────────────────────────────────────────────────────
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    // TIMELOCK_ROLE = adresse du TimelockController (gouvernance)
    bytes32 public constant TIMELOCK_ROLE  = keccak256("TIMELOCK_ROLE");

    // ─── CONSTANTES ───────────────────────────────────────────────────────────
    uint256 public constant FEE_DENOMINATOR = 10_000;   // base points
    uint256 public constant MAX_FEE         = 2_000;    // cap max 20% (protection)
    uint256 public constant BUFFER_BPS      = 1_000;    // 10% du TVL en buffer Aave

    // ─── STATE ────────────────────────────────────────────────────────────────
    IAdapter[] public adapters;
    uint256[]  public weights;             // basis points, somme = 10_000
    uint256    public performanceFee;      // ex: 500 = 5%
    address    public treasury;            // Gnosis Safe
    uint256    public accruedFees;         // USDC équivalent, exclus du totalAssets_net
    uint256    public lastHarvestAssets;   // totalAssets_brut au dernier harvest

    // ─── FONCTIONS CLÉS (logique partagée entre les 4 vaults) ─────────────────

    // Appelé par les vaults enfants dans leur constructeur
    function _initializeAdapters(
        address[] memory _adapters,
        uint256[] memory _weights,
        address _treasury
    ) internal { ... }

    // ERC-4626 override : exclut accruedFees du calcul
    function totalAssets() public view override returns (uint256) {
        uint256 gross = _totalAssetsGross();
        return gross > accruedFees ? gross - accruedFees : 0;
    }

    // Somme brute des positions dans tous les adapters
    function _totalAssetsGross() internal view returns (uint256 total) {
        for (uint256 i = 0; i < adapters.length; i++) {
            total += adapters[i].totalAssets();
        }
    }

    // ─── HARVEST ──────────────────────────────────────────────────────────────
    function harvest() external whenNotPaused {
        _collectFees();
        _rebalance();
    }

    function _collectFees() internal {
        uint256 currentAssets = _totalAssetsGross();
        if (currentAssets <= lastHarvestAssets) {
            lastHarvestAssets = currentAssets;
            return;
        }
        uint256 gain = currentAssets - lastHarvestAssets;
        uint256 fee  = (gain * performanceFee) / FEE_DENOMINATOR;

        // Mint des shares au treasury (jamais de transfert USDC)
        if (fee > 0 && totalSupply() > 0) {
            uint256 newShares = (fee * totalSupply()) / (currentAssets - accruedFees);
            _mint(treasury, newShares);
        }
        accruedFees    = 0;  // reset après harvest
        lastHarvestAssets = _totalAssetsGross();
    }

    // accruedFees mis à jour en continu entre deux harvests (appelé dans _totalAssetsGross)
    // Permet d'exclure la part treasury de totalAssets_net → pas de dépeg au harvest
    function _updateAccruedFees() internal view returns (uint256) {
        uint256 gross = _totalAssetsGross();
        if (gross <= lastHarvestAssets) return 0;
        uint256 gain = gross - lastHarvestAssets;
        return (gain * performanceFee) / FEE_DENOMINATOR;
    }

    // ─── REBALANCING ──────────────────────────────────────────────────────────
    function _rebalance() internal {
        uint256 tvl = totalAssets();
        for (uint256 i = 0; i < adapters.length; i++) {
            uint256 target = (tvl * weights[i]) / FEE_DENOMINATOR;
            uint256 actual = adapters[i].totalAssets();

            // Seuil : ne rebalancer que si dérive > 5% relatif
            if (actual == 0) {
                adapters[i].deposit(target);
                continue;
            }
            uint256 drift = actual > target
                ? ((actual - target) * 10_000) / target
                : ((target - actual) * 10_000) / target;

            if (drift > 500) {  // 500 bp = 5% relatif
                if (actual > target) adapters[i].withdraw(actual - target);
                else adapters[i].deposit(target - actual);
            }
        }
    }

    // ─── RETRAIT ──────────────────────────────────────────────────────────────
    // ERC-4626 override : d'abord buffer Aave, puis exit proportionnel
    function _withdraw(
        address caller, address receiver, address owner,
        uint256 assets, uint256 shares
    ) internal override whenNotPaused {
        // 1. Brûler les shares
        _burn(owner, shares);

        // 2. Essayer le buffer Aave (adapter[0] = AaveAdapter)
        uint256 bufferAvailable = adapters[0].totalAssets();
        if (assets <= bufferAvailable) {
            adapters[0].withdraw(assets);
        } else {
            // 3. Exit proportionnel sur TOUS les adapters simultanément
            _proportionalExit(assets);
        }

        // 4. Transfer USDC à l'utilisateur
        SafeERC20.safeTransfer(IERC20(asset()), receiver, assets);
    }

    function _proportionalExit(uint256 assets) internal {
        uint256 tvl = _totalAssetsGross();
        for (uint256 i = 0; i < adapters.length; i++) {
            uint256 adapterShare = (assets * adapters[i].totalAssets()) / tvl;
            if (adapterShare > 0) adapters[i].withdraw(adapterShare);
        }
    }

    // ─── FONCTIONS GUARDIAN ───────────────────────────────────────────────────
    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(TIMELOCK_ROLE) {
        _unpause();
    }

    function emergencyExit(address adapter) external onlyRole(GUARDIAN_ROLE) {
        // Ramener tous les fonds de cet adapter dans le vault
        // Fonds restent dans le vault (pas vers une adresse externe)
        uint256 amount = IAdapter(adapter).totalAssets();
        IAdapter(adapter).withdraw(amount);
        // Pas d'emit de distribution — les users retirent normalement via leurs shares
    }

    // ─── FONCTIONS GOUVERNANCE (TIMELOCK uniquement) ──────────────────────────
    function addAdapter(address adapter, uint256 weight) external onlyRole(TIMELOCK_ROLE) { ... }
    function removeAdapter(address adapter) external onlyRole(TIMELOCK_ROLE) { ... }
    function setWeights(uint256[] calldata newWeights) external onlyRole(TIMELOCK_ROLE) { ... }
    function setPerformanceFee(uint256 newFee) external onlyRole(TIMELOCK_ROLE) {
        require(newFee <= MAX_FEE, "Fee trop haute");
        performanceFee = newFee;
    }
    function setTreasury(address newTreasury) external onlyRole(TIMELOCK_ROLE) { ... }

    // ─── ERC-4626 : bloquer les dépôts si pause ───────────────────────────────
    function _deposit(...) internal override whenNotPaused { super._deposit(...); }
    // Note : _withdraw intentionnellement PAS bloqué par whenNotPaused
}
```

### 3.2 Vault enfant (exemple Prudent)

```solidity
contract DeFiLanternVaultPrudent is BaseLanternVault {

    constructor(
        IERC20 usdc,
        address aaveAdapter,
        address morphoPrimeAdapter,
        address morphoSteakhouseAdapter,
        address sUSDSAdapter,
        address sUSDEAdapter,
        address cUSDOAdapter,
        address thBillAdapter,
        address sBOLDAdapter,
        address scrvUSDAdapter,
        address fxSAVEAdapter,
        address _treasury,
        address _guardian,
        address _timelock
    ) ERC4626(usdc) ERC20("DeFi Lantern Prudent", "glUSD-P") {

        address[] memory _adapters = [
            aaveAdapter,          // buffer 10%  → poids 1000 bp
            morphoPrimeAdapter,   // Morpho Gauntlet USDC Prime
            morphoSteakhouseAdapter,
            sUSDSAdapter,
            sUSDEAdapter,
            cUSDOAdapter,
            thBillAdapter,        // cap 5% = 500 bp
            sBOLDAdapter,
            scrvUSDAdapter,
            fxSAVEAdapter
        ];

        uint256[] memory _weights = [
            1000,  // Aave buffer  — 10% (= BUFFER_BPS)
            1125,  // Morpho Prime — 11.25%
            1125,  // Morpho Steakhouse
            1125,  // sUSDS
            1125,  // sUSDe
            1125,  // cUSDO
             500,  // thBILL (cap 5%)
            1125,  // sBOLD
            1125,  // scrvUSD
             625   // fxSAVE (exception TVL ~$53M)
            // Total = 10000 ✓
        ];

        _initializeAdapters(_adapters, _weights, _treasury);
        _grantRole(GUARDIAN_ROLE, _guardian);
        _grantRole(TIMELOCK_ROLE, _timelock);
        performanceFee = 500; // 5%
    }
}
```

### 3.3 `IAdapter.sol`

```solidity
interface IAdapter {
    /// @notice Dépose `amount` USDC dans le protocole sous-jacent
    function deposit(uint256 amount) external;

    /// @notice Retire `amount` USDC du protocole (envoyé vers le vault)
    function withdraw(uint256 amount) external;

    /// @notice Valeur totale des positions en USDC équivalent
    function totalAssets() external view returns (uint256);

    /// @notice True si le protocole impose un délai de retrait
    function hasCooldown() external view returns (bool);

    /// @notice Secondes restantes avant que le retrait en cours soit disponible
    function cooldownRemaining() external view returns (uint256);

    /// @notice Émis à chaque dépôt/retrait dans le protocole sous-jacent
    event AdapterDeposited(uint256 amount);
    event AdapterWithdrawn(uint256 amount);
}
```

### 3.4 `BaseAdapter.sol`

```solidity
abstract contract BaseAdapter is IAdapter, Ownable {
    IERC20 public immutable USDC;
    address public immutable vault; // seul le vault peut appeler deposit/withdraw

    modifier onlyVault() {
        require(msg.sender == vault, "Seul le vault");
        _;
    }

    constructor(address _usdc, address _vault) Ownable(msg.sender) {
        USDC = IERC20(_usdc);
        vault = _vault;
    }

    function hasCooldown() external pure virtual returns (bool) { return false; }
    function cooldownRemaining() external view virtual returns (uint256) { return 0; }
}
```

### 3.5 `SecondaryMarketAdapter.sol` (base abstraite pour thBILL, stcUSD, sUSDe)

Cette base centralise toute la logique marché secondaire documentée dans §7.3 WP.

```solidity
abstract contract SecondaryMarketAdapter is BaseAdapter {

    // Paramètres de protection (configurables par gouvernance)
    uint256 public twapWindow      = 30 minutes;
    uint256 public maxTwapDeviation = 50;   // 0.5% en basis points / 100
    uint256 public maxSlippage      = 50;   // 0.5%
    uint256 public maxPriceImpact   = 30;   // 0.3%
    uint256 public failedCyclesCount;       // compteur d'échecs consécutifs
    uint256 public constant ALERT_THRESHOLD = 3;

    // Adresses
    IUniswapV3Pool public pool;
    address public navOracle;      // source du NAV officiel (Chainlink ou offchain)

    event SwapExecuted(uint256 amountIn, uint256 amountOut);
    event SwapAborted(string reason);
    event AdapterLiquidityAlert(uint256 failedCycles);

    /// @notice Vérifie les conditions et exécute le swap si OK
    /// @return success True si le swap a été exécuté
    function _executeConditionalSwap(
        address tokenIn, address tokenOut, uint256 amountIn
    ) internal returns (bool success) {

        // ① Vérifier TWAP vs NAV officiel
        uint256 twapPrice = _getTWAP(twapWindow);
        uint256 nav       = _getNAV();
        uint256 deviation = _absDiff(twapPrice, nav) * 10_000 / nav;
        if (deviation > maxTwapDeviation) {
            emit SwapAborted("TWAP deviation too high");
            _incrementFailedCycles();
            return false;
        }

        // ② Simuler le slippage estimé
        uint256 estimatedOut = _simulateSwap(tokenIn, tokenOut, amountIn);
        uint256 expectedOut  = amountIn * twapPrice / 1e18;
        uint256 slippage     = _absDiff(estimatedOut, expectedOut) * 10_000 / expectedOut;
        if (slippage > maxSlippage) {
            emit SwapAborted("Slippage too high");
            _incrementFailedCycles();
            return false;
        }

        // ③ Vérifier l'impact de prix — réduire l'ordre si nécessaire
        uint256 adjustedAmountIn = _adjustForPriceImpact(amountIn);
        if (adjustedAmountIn == 0) {
            emit SwapAborted("Price impact too high even for minimum order");
            _incrementFailedCycles();
            return false;
        }

        // ④ Exécuter via Flashbots (mempool privé)
        // Note : en pratique sur Ethereum, on utilise eth_sendPrivateTransaction
        // L'adapter appelle le router Uniswap avec les paramètres calculés
        _executeSwapViaRouter(tokenIn, tokenOut, adjustedAmountIn, estimatedOut);

        failedCyclesCount = 0;  // reset compteur d'échecs
        emit SwapExecuted(adjustedAmountIn, estimatedOut);
        return true;
    }

    function _incrementFailedCycles() internal {
        failedCyclesCount++;
        if (failedCyclesCount >= ALERT_THRESHOLD) {
            emit AdapterLiquidityAlert(failedCyclesCount);
        }
    }

    // À implémenter dans chaque adapter concret
    function _getTWAP(uint256 window) internal view virtual returns (uint256);
    function _getNAV() internal view virtual returns (uint256);
    function _simulateSwap(address, address, uint256) internal view virtual returns (uint256);
    function _adjustForPriceImpact(uint256 amountIn) internal view virtual returns (uint256);
    function _executeSwapViaRouter(address, address, uint256, uint256) internal virtual;
    function _absDiff(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? a - b : b - a;
    }
}
```

---

## 4. Mécanique Harvest — Détail pas à pas

Documentation complète de ce que le code doit faire lors d'un appel `harvest()`.

```
harvest() appelé (multisig équipe en v1)
│
├── 1. LECTURE DES POSITIONS
│      Pour chaque adapter[i] : lire adapter[i].totalAssets()
│      totalAssets_brut = Σ adapter[i].totalAssets()
│
├── 2. CALCUL DES GAINS NETS
│      gain = totalAssets_brut - lastHarvestAssets
│      Si gain ≤ 0 → skip (pas de gains à distribuer)
│
├── 3. PERFORMANCE FEE → MINT SHARES TREASURY
│      fee_usd   = gain × 5%
│      sharePrice_actuel = totalAssets_net / totalSupply   (totalAssets_net = totalAssets_brut - accruedFees)
│      new_shares = fee_usd / sharePrice_actuel
│      _mint(treasury, new_shares)
│      accruedFees = 0  (reset — les fees étaient déjà accrued, le mint ne change pas le sharePrice)
│
├── 4. MISE À JOUR lastHarvestAssets
│      lastHarvestAssets = totalAssets_brut  (après mint)
│
└── 5. REBALANCING (conditionnel)
       Pour chaque adapter[i] :
         target = TVL × weights[i] / 10_000
         actual = adapter[i].totalAssets()
         drift  = |actual - target| / target × 100%
         Si drift > 5% :
           Si actual > target → adapter[i].withdraw(actual - target)
           Si actual < target → adapter[i].deposit(target - actual)
         Si drift ≤ 5% → NE PAS TOUCHER (économie de gas)
         Pour les adapters marché secondaire (thBILL, stcUSD) :
           → Appeler _executeConditionalSwap()
           → Si conditions KO → USDC reste sur Aave, retry prochain harvest
```

**Précision sur Fee Accrual (anti-dépeg) :**

Entre deux harvests, `accruedFees` est mis à jour en temps réel :
```
accruedFees = (totalAssets_brut - lastHarvestAssets) × 5%
totalAssets_net = totalAssets_brut - accruedFees
sharePrice = totalAssets_net / totalSupply
```

Au harvest, le mint de shares au treasury ne change pas `totalAssets_net` car `accruedFees` était déjà soustrait. **Le sharePrice ne chute pas au harvest** — propriété fondamentale ERC-4626.

---

## 5. Mécanique Retrait — Détail pas à pas

```
User appelle withdraw(assets) ou redeem(shares)
│
├── CALCUL
│      Si withdraw(assets) → shares = assets / sharePrice
│      Si redeem(shares)   → assets = shares × sharePrice
│
├── BRÛLER LES SHARES
│      _burn(owner, shares)
│
├── OBTENIR LES USDC
│   ├── Cas 1 : assets ≤ buffer Aave (≈95% des cas)
│   │      adapters[0].withdraw(assets)   // AaveAdapter = adapter[0]
│   │      → Gas : ~$0.20–$0.80. Instantané.
│   │
│   └── Cas 2 : assets > buffer Aave
│          Exit PROPORTIONNEL sur TOUS les adapters simultanément
│          Pour chaque adapter[i] :
│            share_i = assets × (adapter[i].totalAssets() / totalAssets_brut)
│            adapter[i].withdraw(share_i)
│          Règle absolue : on ne vide JAMAIS les adapters liquides en premier.
│          Les utilisateurs restants conservent exactement le même profil de risque.
│          Pour sUSDe (cooldown 7j) :
│            → Essayer Curve pool (swap sUSDe → USDC) si décote < 1%
│            → Sinon : user reçoit montant partiel immédiatement + attente cooldown 7j
│
└── TRANSFER USDC À L'UTILISATEUR
       SafeERC20.safeTransfer(USDC, receiver, assets)
```

---

## 6. Marché Secondaire — Implémentation

### Protocoles concernés

| Protocole | Raison marché secondaire | DEX | Seuils |
|-----------|--------------------------|-----|--------|
| thBILL (Theo Network) | KYC requis au primaire | Uniswap V3 | TWAP ±0.5%, slip ≤0.5%, impact ≤0.3% |
| stcUSD (Cap) | KYC requis au primaire | Uniswap V3 | Mêmes seuils |
| sUSDe (Ethena) | Cooldown 7j — sortie urgente | Curve sUSDe/USDC | Décote max 1% |

### Lire le TWAP Uniswap V3

```solidity
// Uniswap V3 expose observe() pour lire les prix historiques
function _getTWAP(uint256 secondsAgo) internal view returns (uint256 price) {
    uint32[] memory secondsAgos = new uint32[](2);
    secondsAgos[0] = uint32(secondsAgo);  // ex: 1800 = 30 min
    secondsAgos[1] = 0;

    (int56[] memory tickCumulatives,) = pool.observe(secondsAgos);
    int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
    int24 arithmeticMeanTick   = int24(tickCumulativesDelta / int56(int256(secondsAgo)));
    price = OracleLibrary.getQuoteAtTick(arithmeticMeanTick, 1e6, USDC, token);
}
```

### Logique de décision thBILL (arbre complet)

```
Au harvest, si dérive thBILL > 5% relatif :
│
├── ① TWAP 30min vs NAV officiel
│      TWAP = lecture pool Uniswap V3
│      NAV  = prix publié par Theo Network (via oracle ou offchain signé)
│      Écart = |TWAP - NAV| / NAV
│      Si écart > 0.5% → ABORT. USDC reste Aave. failedCycles++
│
├── ② Slippage estimé (simulation order)
│      Simuler le swap du montant cible
│      Si slippage estimé > 0.5% → ABORT
│
├── ③ Impact de prix
│      pool_liquidity = getPoolLiquidity(pool)
│      impact = amountIn / pool_liquidity × scaling_factor
│      Si impact > 0.3% → réduire amountIn jusqu'à impact ≤ 0.3%
│      Si même au minimum → ABORT
│
├── ④ Swap exécuté via Flashbots
│      swapRouter.exactInputSingle({
│          tokenIn:  USDC,
│          tokenOut: thBILL,
│          fee:      pool.fee(),
│          amountIn: adjustedAmount,
│          amountOutMinimum: expectedOut × (1 - maxSlippage),
│          sqrtPriceLimitX96: 0
│      });
│      failedCycles = 0  // reset
│
└── Après 3 harvests consécutifs en ABORT :
       emit AdapterLiquidityAlert(failedCycles)
       → Gouvernance GLOW examine et vote
```

### Notes d'implémentation MEV

En v1, la protection MEV (Flashbots) est documentée mais son implémentation dépend de l'infrastructure :
- **Simple v1** : utiliser `amountOutMinimum` dans le swap avec un slippage strict — protection partielle
- **v1 robuste** : utiliser Flashbots Protect RPC au niveau du script de harvest (pas dans le contrat lui-même — le multisig envoie la tx via Flashbots Protect)
- **v2 on-chain** : intégration Flashbots MEV Blocker ou CoW Protocol directement dans le contrat

---

## 7. Gouvernance — Implémentation

### Contrats utilisés (OpenZeppelin v5)

```
GlowToken.sol
  └── ERC20Votes (d'OpenZeppelin)
      Pas de mint post-deploy. Supply = 100M. Pas de burn.

DeFiLanternGovernor.sol
  └── Governor (d'OpenZeppelin)
      + GovernorSettings       ← votingDelay, votingPeriod, proposalThreshold
      + GovernorCountingSimple ← Pour/Contre/Abstention
      + GovernorVotes          ← intégration ERC20Votes
      + GovernorVotesQuorumFraction ← quorum 10%
      + GovernorTimelockControl     ← intégration TimelockController

TimelockController.sol
  └── TimelockController (d'OpenZeppelin)
      minDelay = 48 heures
      proposers = [Governor]      ← seul le Governor peut créer des opérations
      executors = [address(0)]    ← n'importe qui peut exécuter après délai
      admin    = [address(0)]     ← pas d'admin (trustless)
```

### Paramètres du Governor

```solidity
constructor() Governor("DeFi Lantern Governor") {
    // Ces valeurs sont en blocs Ethereum (≈12s/bloc)
    // 1 jour = 7200 blocs, 3 jours = 21600 blocs, 48h = 14400 blocs
    __GovernorSettings_init(
        7_200,   // votingDelay:    1 jour
        21_600,  // votingPeriod:   3 jours
        1_000_000e18  // proposalThreshold: 1M GLOW = 1% supply
    );
    __GovernorVotesQuorumFraction_init(10); // quorum 10%
}
```

### Qui peut appeler quoi

```
addAdapter(addr)         ← onlyRole(TIMELOCK_ROLE)
removeAdapter(addr)      ← onlyRole(TIMELOCK_ROLE)
setWeights(uint256[])    ← onlyRole(TIMELOCK_ROLE)
setPerformanceFee(uint)  ← onlyRole(TIMELOCK_ROLE)
setTreasury(addr)        ← onlyRole(TIMELOCK_ROLE)
pause()                  ← onlyRole(GUARDIAN_ROLE)     ← multisig 2/3
unpause()                ← onlyRole(TIMELOCK_ROLE)     ← vote GLOW requis
emergencyExit(adapter)   ← onlyRole(GUARDIAN_ROLE)     ← multisig 2/3
harvest()                ← public (ou onlyGuardian en v1)
```

### Ce que le Guardian NE peut PAS faire — hardcodé dans le contrat

Le Guardian n'a accès qu'à `pause()` et `emergencyExit()`. Ces deux fonctions sont limitées dans leur effet :
- `pause()` ne peut pas bloquer les retraits (le modificateur `whenNotPaused` n'est PAS sur `_withdraw`)
- `emergencyExit()` ramène les fonds DANS le vault (pas vers une adresse externe) — les users retirent normalement

Aucun rôle (y compris TIMELOCK) ne peut appeler `transfer()` ou `transferFrom()` sur les USDC des users. La non-custodialité est garantie par le design.

---

## 8. `GlowToken.sol`

```solidity
contract GlowToken is ERC20, ERC20Votes, ERC20Permit {

    uint256 public constant MAX_SUPPLY = 100_000_000e18; // 100M tokens

    constructor(address treasury) ERC20("GLOW", "GLOW") ERC20Permit("GLOW") {
        // Mint de la totalité au déploiement
        // La distribution (vesting, liquidity mining) est gérée off-chain ou via contrats séparés
        _mint(treasury, MAX_SUPPLY);
    }

    // Pas de fonction mint() publique → supply fixe, inflation impossible
    // Override requis par Solidity pour ERC20Votes + ERC20
    function _update(address from, address to, uint256 amount)
        internal override(ERC20, ERC20Votes) {
        super._update(from, to, amount);
    }

    function nonces(address owner)
        public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
```

### Distribution (à gérer via contrats de vesting séparés)

| Allocation | % | Montant | Vesting |
|------------|---|---------|---------|
| Équipe (5 fondateurs) | 20% | 20M | Cliff 12 mois + linéaire 24 mois |
| Treasury / DAO | 40% | 40M | Géré par la DAO |
| Communauté / Liquidity Mining | 30% | 30M | Émission sur 48 mois |
| Écosystème / Grants | 10% | 10M | Discrétionnaire DAO |

---

## 9. Pondération des allocations

Stockée on-chain en **basis points** (1 bp = 0.01%, somme = 10 000 bp = 100%).

```solidity
// Profil Prudent — 10 adapters
uint256[] memory weights = [
    1000,  // Aave v3 (buffer liquidité — TOUJOURS premier)
    1125,  // Morpho Gauntlet USDC Prime
    1125,  // Morpho Steakhouse USDC
    1125,  // sUSDS (Sky)
    1125,  // sUSDe (Ethena) — cooldown 7j géré
    1125,  // cUSDO (OpenEden)
     500,  // thBILL (Theo Network) — cap 5% (protocole en exception)
    1125,  // sBOLD (Liquity v2)
    1125,  // scrvUSD (Curve)
     625   // fxSAVE (f(x) Protocol)
];
// Somme : 1000+1125×7+500+625 = 10000 ✓

// Profil Dynamic — 10 adapters × 1000 bp = 10000
// Profil Balanced — 50% des weights Prudent + 50% des weights Dynamic (calculé programmatiquement)
// Profil Airdrop Hunter — 4 adapters × 2500 bp = 10000
```

**Adapter[0] = AaveAdapter est toujours le buffer liquide.** Son poids cible = BUFFER_BPS = 1000 (10%). C'est une invariante : ne jamais mettre l'AaveAdapter ailleurs dans le tableau.

---

## 10. Adapters — Cas particuliers

### AaveAdapter (buffer liquidité)

```
deposit(amount)     → supply(USDC, aave_pool)      → reçoit aUSDC
withdraw(amount)    → withdraw(USDC, aave_pool)    → reçoit USDC
totalAssets()       → aToken.balanceOf(address(this)) (augmente automatiquement)
hasCooldown()       → false
```

### MorphoAdapter (deux instances : Prime + Steakhouse)

```
deposit(amount)     → ERC4626.deposit(amount, address(this))
withdraw(amount)    → ERC4626.withdraw(amount, vault, address(this))
totalAssets()       → ERC4626.convertToAssets(balanceOf(address(this)))
hasCooldown()       → false
```

Note : instancier le contrat avec l'adresse de la vault Morpho spécifique (Prime ≠ Steakhouse).

### sUSDSAdapter (USDC → USDS → sUSDS)

```
deposit(amount)     → PSM.swap(USDC, USDS, amount) puis sUSDS.deposit(usds)
withdraw(amount)    → sUSDS.redeem(shares) → USDS → PSM.swap(USDS, USDC, amount)
totalAssets()       → sUSDS.convertToAssets(balanceOf) — en USDS ≈ USDC (peg 1:1)
```

### sUSDEAdapter (cooldown 7 jours)

```
deposit(amount)     → swap USDC → USDe (pool Curve) → sUSDe.deposit(ude)
withdraw(amount)    → CAS 1 : swap sUSDe → USDC via Curve (si décote < 1%) ← sortie urgente
                      CAS 2 : déclencher cooldown Ethena (7j) si décote > 1%
totalAssets()       → sUSDe.convertToAssets(balanceOf) en USDe × prix USDe/USDC
hasCooldown()       → true si cooldown actif
cooldownRemaining() → timestamp cooldown - block.timestamp
```

### thBillAdapter (marché secondaire Uniswap V3)

```
Hérite de SecondaryMarketAdapter
deposit(amount)     → _executeConditionalSwap(USDC, thBILL, amount)  ← TWAP + slippage + impact
withdraw(amount)    → _executeConditionalSwap(thBILL, USDC, amount)
totalAssets()       → thBILL.balanceOf(this) × thBILL_price_TWAP  (ou NAV si disponible)
hasCooldown()       → false
```

### MorphoAdapter — Deux instances

Même code, deux déploiements avec des adresses de vault Morpho différentes :
- `0x...` = Gauntlet USDC Prime
- `0x...` = Steakhouse USDC

---

## 11. Ordre de développement conseillé (MVP First)

L'objectif MVP (Semaine 1–3) est d'avoir **un vault fonctionnel avec 2–3 adapters testés** sur fork mainnet.

### Phase 1 — Fondations (Semaine 1)

```
1. IAdapter.sol                → l'interface (trivial, 15 min)
2. BaseAdapter.sol             → la base abstraite (1h)
3. AaveAdapter.sol             → le plus simple, pas de swap (2h)
4. BaseLanternVault.sol        → sans harvest ni rebalancing d'abord :
                                  uniquement deposit/withdraw/totalAssets (4h)
5. DeFiLanternVaultPrudent.sol → hérite BaseLanternVault, un seul adapter (AaveAdapter) (1h)
6. Tests Foundry :
   - test_deposit_withdraw_simple (fork mainnet Aave)
   - test_sharePrice_increases
   - test_non_custodial (guardian ne peut pas voler les fonds)
```

### Phase 2 — Harvest + Fees (Semaine 2)

```
7. FeeManager / fee accrual dans BaseLanternVault
8. harvest() complet
9. MorphoAdapter.sol (ERC-4626, le plus proche d'Aave côté code)
10. sUSDSAdapter.sol (ERC-4626 + PSM swap)
11. Tests :
    - test_harvest_fees_minted_to_treasury
    - test_sharePrice_no_depeg_at_harvest (FeeAccrual)
    - test_rebalancing_threshold (drift > 5% → rebalance, < 5% → skip)
```

### Phase 3 — Adapters complexes + Emergency (Semaine 3)

```
12. sUSDEAdapter (cooldown + sortie Curve)
13. thBillAdapter (SecondaryMarketAdapter, TWAP, Flashbots)
14. Gouvernance :
    - GlowToken.sol
    - DeFiLanternGovernor.sol
    - TimelockController.sol
15. Connexion Guardian / Timelock aux vaults
16. Tests emergency :
    - test_guardian_can_pause (dépôts bloqués)
    - test_withdrawals_work_while_paused
    - test_emergencyExit_brings_funds_to_vault
    - test_guardian_cannot_steal_funds
```

### Phase 4 — Autres profils + intégration (Semaine 4–5)

```
17. DeFiLanternVaultDynamic.sol + ses adapters
18. DeFiLanternVaultAirdropHunter.sol + ses adapters
19. DeFiLanternVaultBalanced.sol (= agrège Prudent + Dynamic)
20. Tests d'intégration complets sur fork mainnet
21. Deploy Sepolia
```

### Simplifications si retard

Si la timeline est serrée, dans cet ordre de priorité :

1. **Réduire à 1 vault** (Balanced ou Prudent uniquement) + 3 adapters (Aave + Morpho + sUSDS)
2. **Remplacer Governor + Timelock par un multisig Gnosis Safe** (même fonctionnalité, beaucoup moins de code)
3. **Supprimer les adapters marché secondaire** (thBILL, stcUSD) — reporter en v2

---

## 12. Tests Foundry — Priorités

```solidity
// Tests fondamentaux (non-négociables)
test_deposit_mints_correct_shares()
test_withdraw_burns_correct_shares()
test_sharePrice_increases_monotonically()
test_harvest_mints_fee_shares_to_treasury()
test_harvest_no_sharePrice_depeg()          // FeeAccrual
test_proportional_exit_preserves_weights()  // exit proportionnel
test_guardian_pause_blocks_deposits()
test_withdrawals_work_while_paused()        // non-custodial garanti
test_guardian_cannot_transfer_usdc()        // NON-CUSTODIAL CRITIQUE

// Tests adapters (sur fork mainnet)
test_aave_deposit_withdraw_integration()
test_morpho_deposit_withdraw_integration()
test_sUSDS_deposit_withdraw_integration()

// Tests marché secondaire (sur fork mainnet)
test_thBill_twap_check_aborts_on_high_deviation()
test_thBill_slippage_check_aborts()
test_thBill_incremental_position_building()

// Tests gouvernance
test_only_timelock_can_add_adapter()
test_vote_and_execute_setWeights()
test_timelock_delay_enforced()
```

---

## 13. Variables d'environnement Foundry

```toml
# foundry.toml
[profile.default]
src    = "contracts"
test   = "test"
script = "script"
out    = "out"
libs   = ["lib"]
solc_version = "0.8.25"

[rpc_endpoints]
mainnet = "${ETH_RPC_URL}"  # fork ETH mainnet pour les tests d'intégration
sepolia = "${SEPOLIA_RPC_URL}"

[etherscan]
mainnet = { key = "${ETHERSCAN_API_KEY}" }
```

```bash
# Lancer un test sur fork mainnet
forge test --fork-url $ETH_RPC_URL -vv

# Lancer tous les tests avec rapport de gas
forge test --fork-url $ETH_RPC_URL --gas-report
```

---

## 14. Adresses mainnet utiles

| Protocole | Adresse |
|-----------|---------|
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Aave v3 Pool | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` |
| aUSDC (Aave v3) | `0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c` |
| Morpho (singleton) | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` |
| Morpho Gauntlet USDC Prime | `0xdd0f28e19C1780eb6396170735D45153D261490d` |
| Morpho Steakhouse USDC | `0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB` |
| sUSDS (Sky) | `0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD` |
| sUSDe (Ethena) | `0x9D39A5DE30e57443BfF2A8307A4256c8797A3497` |
| PSM USDC→USDS | `0x...` (vérifier via docs Sky) |
| Uniswap V3 Router | `0xE592427A0AEce92De3Edee1F18E0157C05861564` |
| Uniswap V3 Quoter | `0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6` |

---

*Document interne — DeFi Lantern Protocol — Mars 2026 — v2.0*
*À maintenir en sync avec DeFiLantern_Whitepaper_v0.2.md*
*Référence : protocole-explication-equipe.pdf · gouvernance-explication.pdf · marche-secondaire-explication.pdf*
