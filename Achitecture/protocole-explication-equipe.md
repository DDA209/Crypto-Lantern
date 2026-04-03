# DeFi Lantern Protocol — Fonctionnement complet
*Document interne équipe — Mars 2026*

---

## Vue d'ensemble en une phrase

L'utilisateur dépose des USDC → reçoit des shares glUSD → ses USDC sont déployés sur plusieurs protocoles lors du prochain harvest → les rendements augmentent la valeur de ses shares → quand il retire, il brûle ses shares et récupère USDC + rendements.

---

## ÉTAPE 1 — Le dépôt

Alice dépose 1 000 USDC dans le vault Prudent. Le contrat calcule combien de shares lui donner :

```
sharePrice = totalAssets_net() / totalSupply()

shares reçus = montant_déposé / sharePrice
```

**Vault tout neuf (jour 0) :**
- totalAssets = 0, totalSupply = 0 → ratio initial : 1 share = 1 USDC
- Alice reçoit **1 000 glUSD-P**

**Vault actif depuis 6 mois :**
- totalAssets = 5 200 000 USDC (5M déposés + 200k de rendements accumulés)
- totalSupply = 5 000 000 shares
- sharePrice = 5 200 000 / 5 000 000 = **1,040 USDC/share**
- Alice reçoit 1 000 / 1,040 = **961,5 glUSD-P**

### Où vont les USDC d'Alice ?

Les USDC **ne partent pas immédiatement sur les protocoles sous-jacents** (thBILL, sUSDe, Morpho...).

Ils vont dans le **buffer Aave v3** — une réserve permanente représentant 10% du TVL total. Ils génèrent le **rendement courant d'Aave v3 sur USDC** en attendant le prochain harvest. Ils seront déployés sur les autres protocoles lors du prochain harvest.

---

## ÉTAPE 2 — Entre deux harvests

Les protocoles sous-jacents accumulent de la valeur automatiquement, sans aucune intervention. Cette valeur reste dans les protocoles et fait monter `totalAssets()`.

```
sharePrice = totalAssets_net() / totalSupply()
```

totalSupply ne change pas → totalAssets_net monte → **le prix du share monte en continu**.

Le harvest ne crée pas les gains. Il les officialise et prend la performance fee dessus.

---

## ÉTAPE 3 — Le harvest

### Quand est-ce déclenché ?

**v1 : manuellement par le multisig équipe.** Aucun keeper automatique.

Un harvest est déclenché quand :
- Un dépôt ou retrait significatif a eu lieu (capital à déployer ou buffer à reconstituer)
- Les gains accumulés depuis le dernier harvest justifient le coût de la transaction

> **Attention coût :** harvester trop souvent sur un petit TVL peut détruire le rendement. Voir tableau des coûts ci-dessous.

**v2 :** keeper automatique (Chainlink Automation / Gelato).

---

### ① Pas de claim() — tous les protocoles Prudent auto-compoundent

Tous les protocoles du vault Prudent sont soit ERC-4626, soit nativement auto-compoundants :

| Protocole | Type | Auto-compound |
|-----------|------|--------------|
| Aave v3 (aUSDC) | Lending | ✓ Solde aUSDC augmente automatiquement |
| Morpho Gauntlet USDC Prime | ERC-4626 | ✓ Valeur monte seule |
| Morpho Steakhouse USDC | ERC-4626 | ✓ |
| sUSDS (Sky) | ERC-4626 | ✓ |
| sUSDe (Ethena) | ERC-4626 | ✓ |
| cUSDO (OpenEden) | ERC-4626 | ✓ |
| thBILL (Theo Network) | ERC-4626 | ✓ |
| sBOLD (Liquity v2) | ERC-4626 | ✓ |
| scrvUSD (Curve) | ERC-4626 | ✓ |
| fxSAVE (f(x) Protocol) | ERC-4626 | ✓ |

**Aucun appel `claim()` requis.** On ne s'intéresse qu'au rendement natif — pas aux bonus, points ou airdrops éventuels sur le vault prudent et sur la V1 (car trop couteux sinon de claim à chaque harvest).

Lors de la V2, au moment du harvest une fonction claim() pourra être mise en place et venir claim les rendements supplémentaires (quasi inexistants sur la stratégie prudente).

Économie de gas : ~50–150k gas évités par protocole, soit jusqu'à 1,5M gas économisés sur 10 adapters.

---

### ② Calcul des gains nets

```
gain = Σ adapter[i].totalAssets() maintenant
     − Σ adapter[i].totalAssets() au dernier harvest
```

Simplement la différence de valeur des positions entre deux harvests. Aucun claim, aucun transfert — uniquement des lectures on-chain.

**Exemple :**
- Avant harvest : totalAssets = 10 000 000 USDC
- Maintenant : totalAssets = 10 042 000 USDC
- Gains nets = **42 000 USDC**

---

### ②bis — Fee Accrual : séparation continue des fees (sans dépeg)

**Problème sans ce mécanisme :** au harvest, le mint de shares à la trésorerie augmente `totalSupply` sans changer `totalAssets` → légère chute du prix du share au moment du harvest.

**Solution — variable `accruedFees` :**

Le contrat maintient une variable `accruedFees` qui comptabilise la part des gains appartenant à la trésorerie **en continu**, entre deux harvests. Les fees revenant à la trésorerie sont exclues du `totalAssets()` avant le harvest.

```
totalAssets_net = totalAssets_brut − accruedFees
sharePrice      = totalAssets_net / totalSupply
```

Au fur et à mesure que les protocoles sous-jacents génèrent du rendement, `accruedFees` augmente proportionnellement (5% des gains). Ainsi, au moment du harvest, le mint des shares à la trésorerie n'a aucun impact visible sur la valeur du YBT — ces fees en étaient déjà exclues.

**Au harvest :**
- Les shares mintés à la trésorerie correspondent exactement à `accruedFees` converti au `sharePrice` courant
- `accruedFees` est remis à zéro
- Le prix du share ne bouge pas

**Exemple chiffré (gain 42 000 USDC, TVL 10M) :**

| | Sans FeeAccrual | Avec FeeAccrual |
|---|---|---|
| totalAssets_brut | 10 042 000 | 10 042 000 |
| accruedFees | — | 2 100 |
| totalAssets_net | 10 042 000 | 10 039 900 |
| sharePrice avant harvest | 1,004200 | 1,003990 |
| Shares mintés treasury | ~2 091 | ~2 091 |
| sharePrice après harvest | **1,003990 ↘** | **1,003990 ↔** |

Sans FeeAccrual, le prix chute de ~0,02% au harvest. Avec FeeAccrual, le prix est stable — aucun dépeg visible.

---

### ③ Performance fee (5%)

**Pourquoi au harvest et pas à la sortie ?**

1. **Technique :** quand un utilisateur retire, ses USDC viennent du buffer ou d'exits proportionnels. Il n'y a pas de "gains réalisés" à identifier pour cet utilisateur en particulier — le gain est déjà incorporé dans le prix de son share depuis le dernier harvest. Prendre une fee à la sortie nécessiterait un mini-harvest dédié à chaque retrait → coûteux et complexe.

2. **Standard du secteur :** Yearn Finance, Beefy, Morpho Vaults et la plupart des agrégateurs de rendement appliquent tous leur fee au harvest pour cette même raison.

3. **Alignement :** le treasury ne gagne que si les utilisateurs gagnent.

**Implémentation :**
```
fee        = gain × 5% = 42 000 × 5% = 2 100 USDC
new_shares = fee / sharePrice_actuel
```

Le vault **mint de nouveaux shares** à destination de la trésorerie de la DAO. Jamais de transfert de fonds USDC. Les holders existants sont dilués de 5% des gains uniquement — pas du capital.

---

### ④ Rééquilibrage — seulement si dérive > 5% relatif

Pour économiser du gas, un adapter n'est rebalancé **que si son allocation réelle s'écarte de plus de 5% en relatif** de sa cible.

**Exemple :** thBILL cible = 5% TVL = 500 000 USDC
- Rebalancing si < **475 000** USDC ou > **525 000** USDC
- Dans la fourchette → on ne touche pas

Exemple complet avec TVL 10M :

| Adapter | Cible | Réel | Dérive | Action |
|---------|-------|------|--------|--------|
| Aave buffer | 1 000 000 | 1 048 000 | +4,8% | ✗ Sous le seuil |
| Morpho | 1 500 000 | 1 412 000 | -5,9% | ✓ Déposer 88 000 |
| sUSDS | 1 000 000 | 980 000 | -2,0% | ✗ Sous le seuil |
| thBILL | 500 000 | 471 000 | -5,8% | ✓ Acheter 29 000 via Uniswap |
| sUSDe | 800 000 | 812 000 | +1,5% | ✗ Sous le seuil |

Seuls 2 adapters bougent → gas divisé par 5 par rapport à un rebalancing total.

**Logique marché secondaire (thBILL, stcUSD, sUSDe) :**
```
SI conditions OK au moment du harvest
   (TWAP dans ±0,5% NAV + slippage ≤ 0,5% + impact de prix ≤ 0,3%)
→ Swap exécuté

SINON
→ USDC prévu pour ce protocole reste dans Aave v3 (rendement Aave)
→ Retry au prochain harvest
→ Après 3 harvests consécutifs sans conditions satisfaites : AdapterLiquidityAlert → Alerte la gouvernance
```

---

### Coûts gas selon les scénarios (Ethereum mainnet, ETH à 3 000 $)

| Scénario | Gas estimé | 3 gwei (nuit/weekend) | 10 gwei (normal) | 30 gwei (congestion) |
|----------|-----------|----------------------|-----------------|---------------------|
| Harvest sans rebalancing (snapshot + fee) | ~150k | ~$0,14 | ~$0,45 | ~$1,35 |
| Harvest + 2 adapters rebalancés | ~500k | ~$0,45 | ~$1,50 | ~$4,50 |
| Harvest + 5 adapters rebalancés | ~900k | ~$0,81 | ~$2,70 | ~$8,10 |
| Harvest + 10 adapters (full rebalance) | ~1,8M | ~$1,62 | ~$5,40 | ~$16,20 |
| Grand retrait > buffer (exit 10 adapters) | ~1,8M | ~$1,62 | ~$5,40 | payé par l'user |

**Seuil de rentabilité :** avec 5% de fee, un harvest à $1,50 est rentable dès que le vault a généré **$30 de rendement brut** depuis le dernier harvest.
- À $50 000 TVL, 5% APY → $30 de gains toutes les **8 heures** ✓
- À $10 000 TVL, 5% APY → $30 de gains toutes les **2,2 jours** ✓

---

## ÉTAPE 4 — Le retrait

### Retrait ≤ buffer Aave (cas courant)

Bob veut retirer 50 000 USDC. Buffer Aave = 1 000 000 USDC (10% TVL).

```
50 000 < 1 000 000 → retrait immédiat depuis Aave
```

Bob reçoit ses USDC en une transaction. Ses shares sont brûlés. Gas payé : ~$0,20–$0,80.

### Grand retrait > buffer — exit proportionnel automatique

**Pas besoin de déclencher un harvest préalablement.** La fonction `withdraw()` / `redeem()` du standard ERC-4626 appelle elle-même les adapters pour faire les exits proportionnels en une seule transaction. L'utilisateur paie plus de gas.

**Règle fondamentale : exit proportionnel sur TOUS les adapters.**

On ne vide pas les adapters liquides en premier — cela changerait l'exposition des utilisateurs restants sans leur accord. On réduit chaque position du même pourcentage.

**Exemple — Charlie retire 2 000 000 USDC (20% du TVL de 10M) :**

| Adapter | Avant | Après (-20%) | USDC libérés |
|---------|-------|-------------|-------------|
| Aave buffer | 1 000 000 | 800 000 | 200 000 ✓ immédiat |
| Morpho | 1 500 000 | 1 200 000 | 300 000 ✓ immédiat |
| sUSDS | 1 000 000 | 800 000 | 200 000 ✓ immédiat |
| thBILL | 500 000 | 400 000 | 100 000 via Uniswap (règles TWAP/slippage) |
| sUSDe | 800 000 | 640 000 | 160 000 via Curve si décote < 1%, sinon reçu 7j |
| ... | ... | ... | ... |
| **Total** | | | **2 000 000 USDC** |

Les utilisateurs restants conservent exactement les mêmes poids, la même exposition, le même profil de risque.

### Exemple de gain — Alice

```
Dépôt : 1 000 USDC — share price = 1,000 → reçoit 1 000 shares
Un an plus tard : share price = 1,052 (5,2% APY net de fees)
Retrait : 1 000 × 1,052 = 1 052 USDC → gain net +52 USDC (+5,2%)
```

Alice n'a rien fait pendant un an. Le rendement était "dans" ses shares.

---

## ÉTAPE 5 — Cas d'urgence

### Pause générale

Guardian appelle `pause()` :
- Nouveaux dépôts bloqués
- Harvest et rebalancing bloqués
- **Retraits toujours possibles** — personne ne peut bloquer les fonds des utilisateurs
- Gouvernance vote sur la résolution → Timelock 48h → exécution

### Hack d'un protocole sous-jacent

Guardian appelle `emergencyExit(adapter)` :
- Tous les fonds du protocole compromis sont ramenés dans le vault
- Les autres adapters continuent normalement
- Utilisateurs peuvent retirer leur part immédiatement
- Gouvernance réalloue le capital sur les adapters restants

### Ce que le Guardian ne peut PAS faire

Il ne peut pas modifier les poids, changer les frais, ajouter un protocole, ni envoyer les fonds vers une adresse externe. Uniquement `pause()` et `emergencyExit()`. Tout le reste passe par un vote de gouvernance GLOW.

---

## Timeline d'une semaine type

```
LUNDI 9h
Alice dépose 10 000 USDC
→ Reçoit 9 615 glUSD-P (share price = 1,040 USDC)
→ 10 000 USDC vont dans le buffer Aave v3 (rendement Aave courant)

LUNDI → VENDREDI
Les protocoles accumulent de la valeur automatiquement.
Share price : 1,0400 → 1,0408 (monte en continu, chaque seconde)

VENDREDI 14h — HARVEST (dépôt significatif de lundi à déployer)
① Gains calculés : totalAssets maintenant vs au dernier harvest = +42 000 USDC
② Fee : 42 000 × 5% = 2 100 USDC → mint de shares au treasury
③ Rebalancing : seuls Morpho (-5,9%) et thBILL (-5,8%) sont ajustés
   → Les 10 000 USDC d'Alice partiellement déployés selon les poids cibles
④ Marché secondaire thBILL : TWAP OK, slippage OK → 29 000 USDC achetés ✓

SAMEDI
Bob retire 5 000 USDC → buffer Aave → immédiat
Bob était entré à share price 1,000, il sort à 1,041 → gain +4,1%
```

---

## 5 points clés à retenir

| # | Point |
|---|-------|
| 1 | **ERC-4626 :** sharePrice = totalAssets_net / totalSupply. Monte automatiquement à chaque seconde. |
| 2 | **Dépôt → buffer Aave** (rendement Aave courant), déployé sur les autres protocoles au prochain harvest. |
| 3 | **Harvest v1 = manuel**, déclenché sur dépôt/retrait significatif. Pas de `claim()` — tous les protocoles Prudent auto-compoundent. |
| 4 | **Grand retrait = exit proportionnel automatique** via `withdraw()` — pas de harvest préalable, l'user paie le gas des exits. |
| 5 | **Marché secondaire :** swap exécuté uniquement si conditions OK au moment du harvest, sinon USDC reste sur Aave jusqu'au suivant. |
| 6 | **Fee Accrual :** `accruedFees` exclues de `totalAssets()` en continu → harvest sans dépeg du share price. |

---

*Document généré le 23 mars 2026 — à maintenir en sync avec DeFiLantern_Whitepaper_v0.2.md*
