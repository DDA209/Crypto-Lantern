# DeFi Lantern — Whitepaper v0.2 (Draft)

> **Status : Draft — March 2026. All parameters subject to change.**

---

## Abstract

DeFi Lantern is a non-custodial, multi-protocol yield aggregator for stablecoins deployed on Ethereum mainnet. Users deposit USDC into one of four risk-profile vaults and receive a **glUSD** ERC-4626 share token whose value appreciates over time as the protocol harvests yield from a curated set of DeFi protocols. DeFi Lantern targets stablecoin holders seeking optimized, passive yield without active portfolio management, market exposure, or counterparty custody risk. The four profiles — **Prudent** (3–7% APY), **Balanced** (5–10%), **Dynamic** (8–15%), and **Airdrop Hunter** (variable) — span lending markets, RWA savings instruments, delta-neutral strategies, institutional credit, and early-stage protocols with tokenomics upside. Governance is conducted on-chain via the **GLOW** token through a Governor + Timelock architecture, with a Guardian multisig retaining pause-only powers.

---

## 1. Introduction

### 1.1 The Stablecoin Yield Problem

Stablecoin holders face a fragmented yield landscape. Dozens of protocols offer competitive APYs, each with distinct risk profiles, liquidity windows, cooldown periods, and integration complexity. A typical investor must:

- Monitor rates across multiple protocols simultaneously
- Manually rebalance capital between strategies
- Manage cooldown periods and withdrawal queues independently
- Evaluate smart contract, oracle, and counterparty risks for each protocol

This friction results in either yield left on the table (capital sitting idle) or excessive risk concentration (overexposure to a single protocol).

### 1.2 The DeFi Lantern Answer

DeFi Lantern aggregates yield from multiple protocols into a single vault. The user deposits USDC once and receives glUSD shares that appreciate passively. DeFi Lantern handles allocation, harvesting, and rebalancing. The underlying protocols are selected through a rigorous due diligence process.

DeFi Lantern does not take custody of user funds — assets remain in the underlying protocols at all times, accessible only through the vault's non-custodial withdrawal mechanism.

---

## 2. Protocol Overview

### 2.1 Core Properties

| Property | Value |
|---|---|
| Blockchain | Ethereum mainnet |
| Deposit asset | USDC |
| Share tokens | **glUSD-P** (Prudent) · **glUSD-B** (Balanced) · **glUSD-D** (Dynamic) · **glUSD-AH** (Airdrop Hunter) |
| Standard | ERC-4626 (all vaults) |
| Governance token | GLOW (ERC-20Votes, 100M fixed supply) |
| Fee | 5% performance fee on net gains (mint of shares to treasury) |
| Custody | Non-custodial |
| Withdrawals | Non-custodial, user-initiated, proportional |
| Rebalancing | Governance-controlled |

### 2.2 Key Features

**Single-entry yield.** One USDC deposit gives exposure to up to twenty yield strategies simultaneously.

**ERC-4626 compliant.** glUSD is a fully standard ERC-4626 vault token, composable with any protocol that supports the standard.

**Non-custodial by design.** No admin key can move user funds. The Guardian multisig can only pause new deposits or trigger an emergency exit on a specific protocol — withdrawals remain open at all times.

**Transparent allocation.** Target weights per protocol are stored on-chain in basis points (sum = 10,000). Any GLOW holder can verify the strategy at any time.

**On-chain governance.** All parameter changes go through a Governor contract with a 48-hour Timelock.

---

## 3. Architecture

### 3.1 ERC-4626 Vault — glUSD

The central contract `DeFiLanternVault.sol` implements the ERC-4626 tokenized vault standard. Users interact exclusively with this contract.

**Deposit flow:**
1. User calls `deposit(amount, receiver)`
2. Vault pulls USDC from the user
3. Vault mints glUSD shares proportional to `amount / pricePerShare`
4. USDC is allocated to underlying protocols according to target weights

**Withdrawal flow:**
1. User calls `redeem(shares, receiver, owner)` or `withdraw(amount, receiver, owner)`
2. Vault burns glUSD shares
3. Vault draws from the liquidity buffer first (held in Aave v3); if the withdrawal exceeds the buffer, the remainder is withdrawn proportionally from all adapters
4. USDC is sent to the user

**Share price** (`pricePerShare`) increases monotonically as yield is harvested. A user who deposits 1,000 USDC and receives 1,000 glUSD at t=0 will redeem those 1,000 glUSD for 1,050 USDC at t=1 year (assuming a 5% net APY after fees).

### 3.2 Adapter Pattern

Each underlying protocol is integrated via a dedicated adapter contract implementing the `IAdapter` interface:

```solidity
interface IAdapter {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function totalAssets() external view returns (uint256);
    function hasCooldown() external view returns (bool);
    function cooldownRemaining() external view returns (uint256);
}
```

This pattern isolates protocol-specific logic from the vault core. Adding or removing a protocol requires only deploying a new adapter and a governance vote — the vault itself is never redeployed.

### 3.3 Smart Contract Structure

```
contracts/
├── vaults/
│   ├── DeFiLanternVaultPrudent.sol      ← ERC-4626, glUSD-P
│   ├── DeFiLanternVaultBalanced.sol     ← ERC-4626, glUSD-B
│   ├── DeFiLanternVaultDynamic.sol      ← ERC-4626, glUSD-D
│   └── DeFiLanternVaultAirdropHunter.sol← ERC-4626, glUSD-AH
├── interfaces/
│   └── IAdapter.sol                     ← Common adapter interface
├── adapters/
│   │   — Prudent profile —
│   ├── AaveAdapter.sol                  ← Liquidity buffer (10% TVL)
│   ├── MorphoGauntletAdapter.sol
│   ├── MorphoSteakhouseAdapter.sol
│   ├── sUSDSAdapter.sol
│   ├── sUSDEAdapter.sol                 ← 7-day cooldown
│   ├── cUSDOAdapter.sol
│   ├── sBOLDAdapter.sol
│   ├── scrvUSDAdapter.sol
│   ├── fxSAVEAdapter.sol
│   ├── thBillAdapter.sol                ← Secondary market (Uniswap V3, TWAP 30min)
│   │   — Dynamic profile —
│   ├── sNUSDAdapter.sol
│   ├── syrupUSDCAdapter.sol
│   ├── jrUSDEAdapter.sol
│   ├── sUSD3Adapter.sol
│   ├── imUSDAdapter.sol
│   ├── reUSDEAdapter.sol
│   ├── stkUSDCAdapter.sol
│   ├── InfiniFIAdapter.sol
│   ├── ReservoirAdapter.sol
│   ├── sUSDaiAdapter.sol                ← Also in Airdrop Hunter; redemption periods
│   │   — Airdrop Hunter exclusive —
│   ├── SierraAdapter.sol                ← LayerZero OFT bridge wrapping
│   └── CapAdapter.sol
├── governance/
│   ├── GLOWToken.sol                    ← ERC-20Votes (GLOW), 100M fixed
│   ├── DeFiLanternGovernor.sol          ← OZ Governor
│   └── TimelockController.sol
└── utils/
    └── FeeManager.sol
```

### 3.4 Risk Profiles

DeFi Lantern offers **4 independent vaults**, each with its own share token, target protocol set, and risk philosophy. Users can hold multiple profiles simultaneously — they are fully isolated from each other. Each vault stores its allocation weights on-chain in basis points (sum = 10,000); the `rebalance()` function adjusts them via governance vote.

| | 🛡️ Prudent | ⚖️ Balanced | ⚡ Dynamic | 🪂 Airdrop Hunter |
|---|---|---|---|---|
| **Token** | glUSD-P | glUSD-B | glUSD-D | glUSD-AH |
| **APY target** | 3–7% | 5–10% | 8–15% | Variable |
| **# protocols** | 10 | 20 | 10 | 4 |
| **Composition** | Conservative lending + RWA | Equal blend of Prudent & Dynamic | High-yield, higher risk | Early-stage, tokenomics upside |
| **Liquidity** | Instant (buffer) / 7d (sUSDe) | Mixed | Mixed | Variable |
| **KYC protocols** | None | Dynamic half only | Acceptable | Acceptable |
| **Airdrop potential** | None | Partial (Dynamic half) | Partial | Primary thesis |
| **Ideal user** | Capital preservation, low volatility | Diversification, balanced exposure | Yield maximization | Early adopter with risk tolerance |

---

#### 🛡️ glUSD-P — Prudent

Capital preservation first. The vault prioritizes protocols with Tier-1 audits, on-chain timelocks, and immutable code. No single yield-generating protocol may exceed 15% of TVL. A mandatory **10% liquidity buffer** is deployed on Aave v3 as a separate reserve — it is not a yield allocation and is never used to pay yield. When a user withdraws, the vault draws from this buffer first; no other user's position in any protocol is affected.

---

#### ⚡ glUSD-D — Dynamic

Yield maximization for users who accept higher underlying risk. Strategies include institutional credit (KYC-gated protocols), delta-neutral leverage, junior tranches, and AI/RWA collateral. No single protocol exceeds 15% of TVL. Protocol selection is discretionary and reviewed quarterly.

---

#### ⚖️ glUSD-B — Balanced

A pure mechanical blend: every USDC deposited is split 50/50 between Prudent and Dynamic allocations, giving simultaneous exposure to all 20 protocols. There are no protocols exclusive to Balanced. The Prudent half contributes a proportional 5% liquidity buffer.

---

#### 🪂 glUSD-AH — Airdrop Hunter

Position on early-stage protocols that combine competitive yield with a credible tokenomics event (airdrop, points program, or upcoming TGE). The yield is real and primary — the airdrop potential is a documented bonus, never a promised return. Positions are reviewed quarterly; any protocol whose tokenomics event has passed and whose rationale has expired is replaced.

---

## 4. Underlying Protocols

### 4.1 Selection Methodology

DeFi Lantern operates **4 risk profiles** with distinct selection criteria. All profiles share universal filters; each then applies profile-specific thresholds.

#### Universal Filters (all profiles, non-negotiable)

| Filter | Requirement |
|---|---|
| EVM-compatible | Solidity adapter possible — native or EVM bridge |
| No unresolved hack | No exploit >$1M unpaid in the last 12 months |
| Active protocol | Not in wind-down; active team; deployed contracts |
| Verifiable code | Public source or on-chain verified contracts |

#### Per-Profile Criteria

| Criterion | 🛡️ Prudent | ⚖️ Balanced | ⚡ Dynamic | 🪂 Airdrop Hunter |
|---|---|---|---|---|
| **Min TVL** | >$100M | >$20M | >$5M | None |
| **Min age** | >1 year (protocol or team) | >3 months | >1 month | None |
| **Audits** | ≥1 recognized firm | ≥1 (any level) | ≥1 OR public code | Recommended, not required |
| **KYC / Permissioned** | No (or liquid secondary) | No (or liquid secondary) | Acceptable if manageable | Acceptable |
| **Timelock** | Strongly recommended | Optional | Not required | Not required |
| **Oracle** | Chainlink preferred | Any documented | Any | Any |
| **Target APY** | 3–7% | 5–10% | 8–15% | >0% |
| **Max allocation per protocol** | 15% | 15% | 15% | 25% |

> 🪂 **Airdrop Hunter additional requirement:** documented or probable tokenomics event (airdrop, points program, TGE, or future token issuance). Airdrops are a potential bonus — never a promised return.

---

### 4.2 Retained Protocols by Profile

#### 🛡️ Prudent — 10 protocols — APY target 3–7%

| Protocol | Category | Weight | APY | Notes |
|---|---|---|---|---|
| **Liquidity Buffer (Aave v3)** | **Instant Withdrawals** | **10%** | — | Mandatory reserve — not a yield allocation |
| **Aave v3 USDC** | Lending | 15% | 3–5% | Tier-1 lending reference |
| **Morpho Gauntlet USDC Prime** | Lending | 15% | 3–4% | Blue-chip collateral only. $0 bad debt in Nov 2025 stress test. |
| **Morpho Steakhouse USDC** | Lending | 13% | 3–5% | Ultra-conservative curator |
| **sUSDS (Sky)** | Savings Rate | 12% | 4–6% | USDC→USDS via PSM, 1:1 |
| **sBOLD (Liquity v2)** | Stability Pool | 10% | 6–10% | ERC-4626 native, **immutable code** (no admin keys), 3 Tier-1 audits. Team since 2021. No cooldown. |
| **scrvUSD (Curve)** | Savings Rate | 9% | ~6–9% | ERC-4626 native. Yield from crvUSD borrower interest. Trail of Bits + MixBytes + Quantstamp. 7-day timelock. |
| **sUSDe (Ethena)** | Delta-Neutral | 7% | 5–7% | 7-day cooldown, buffer managed |
| **cUSDO (OpenEden)** | RWA T-bills | 5% | 4–5% | Chainlink oracle, ChainSecurity audit |
| **fxSAVE (f(x) Protocol)** | Stability Pool | 3% | ~6–10% | ⚠️ TVL exception ($53M). Justified: 16 audits (100% code), ERC-4626 native, team since 2021. |
| **thBill (Theo Network)** | RWA T-bills | 1% | 2.5–5% | ⚠️ Exception: capped 1%. AAA US T-bills, Standard Chartered + Wellington Mgmt. Secondary market only (Uniswap V3, TWAP 30min). Quarterly review. |

#### ⚡ Dynamic — 10 protocols — APY target 8–15%

| Protocol | Category | Weight | APY target | Notes |
|---|---|---|---|---|
| syrupUSDC (Maple) | Institutional Credit | 15% | ~15% | KYC manageable for this profile |
| sNUSD (Neutrl) | Delta-Neutral | 15% | ~16% | Multi-exchange funding rate strategy |
| jrUSDe (Strata) | Market Neutral | 13% | ~14% | Ethena junior tranche |
| sUSD3 (3Jane) | Institutional Credit | 12% | ~13% | — |
| **sUSDai (USD.AI)** | RWA / AI Credit | 12% | 13–17% | GPU loans, CHIP token Q1 2026 |
| **InfiniFI (siUSD)** | Fractional Reserve | 10% | ~6–9% | Liquid tranche, Certora-audited, TGE early 2026 |
| **Reservoir (srUSD)** | CDP Savings Rate | 8% | ~7.75% | Halborn audited, $526M TVL, DAM token |
| stkUSDC (Aave Umbrella) | Safety Module | 7% | ~8% | Aave risk coverage |
| imUSD (mStable) | Fixed Rate | 5% | ~12% | Pendle PT strategy |
| reUSDe (Re Protocol) | Reinsurance | 3% | ~11% | Junior tranche |

#### ⚖️ Balanced — 20 protocols — APY target 5–10%

Balanced allocates 50% to Prudent strategies and 50% to Dynamic strategies. There are no protocols exclusive to Balanced. Blended weights = each parent profile's weight × 50%.

| Protocol | Origin | Weight |
|---|---|---|
| **Liquidity Buffer (Aave v3)** | Prudent | **5.0%** |
| Aave v3 USDC | Prudent | 7.5% |
| Morpho Gauntlet USDC Prime | Prudent | 7.5% |
| syrupUSDC (Maple) | Dynamic | 7.5% |
| sNUSD (Neutrl) | Dynamic | 7.5% |
| jrUSDe (Strata) | Dynamic | 6.5% |
| Morpho Steakhouse USDC | Prudent | 6.5% |
| sUSD3 (3Jane) | Dynamic | 6.0% |
| sUSDai (USD.AI) | Dynamic | 6.0% |
| sUSDS (Sky) | Prudent | 6.0% |
| sBOLD (Liquity v2) | Prudent | 5.0% |
| InfiniFI (siUSD) | Dynamic | 5.0% |
| scrvUSD (Curve) | Prudent | 4.5% |
| Reservoir (srUSD) | Dynamic | 4.0% |
| stkUSDC (Aave Umbrella) | Dynamic | 3.5% |
| sUSDe (Ethena) | Prudent | 3.5% |
| cUSDO (OpenEden) | Prudent | 2.5% |
| imUSD (mStable) | Dynamic | 2.5% |
| fxSAVE (f(x) Protocol) | Prudent | 1.5% |
| reUSDe (Re Protocol) | Dynamic | 1.5% |
| thBill (Theo Network) | Prudent | 0.5% |

#### 🪂 Airdrop Hunter — 4 protocols — APY variable

| Protocol | Category | Weight | APY | Tokenomics Event | Notes |
|---|---|---|---|---|---|
| Sierra Money | LYT (RWA+DeFi) | 25% | ~4.78% | TGE probable | Avalanche native, ETH via LayerZero OFT |
| **stcUSD (Cap)** | Institutional Credit | 25% | ~6–10% | No token yet → TGE probable | RedStone oracle, immutable contracts, $500M TVL |
| **sUSDai (USD.AI)** | RWA / AI Credit | 25% | ~13–17% | CHIP ICO Q1 2026 | Also in Dynamic; GPU-backed |
| **thBill (Theo Network)** | RWA T-bills | 25% | ~2.5–5% | TGE probable | Also in Prudent (1% cap); institutional backing |

> ⚠️ Airdrops are a potential bonus — never a promised return. Positions are reviewed quarterly; exit if the tokenomics event has passed with no further incentive rationale.

---

### 4.3 Excluded Protocols

| Protocol | Reason |
|---|---|
| Resupply reUSD | ⛔ Hacked June 2025 — $9.5M. Debt repaid but excluded (niche CDP). |
| USR / RLP (Resolv) | ⛔ Hacked March 22, 2026 — $80M exploit (compromised private key → unbacked mint), USR depeg -80% |
| Mountain Protocol USDM | ⛔ Official wind-down — primary market closed August 2025 |
| Moonwell | ⚠️ Oracle misconfiguration February 2026 — $1.78M bad debt unresolved |
| Elixir deUSD | Halted (Stream Finance contagion, $93M) |
| Usual USD0++ | January 2025 depeg, 4-year lock, inflationary tokenomics |
| HLP / JLP / Liminal | Non-EVM (Hyperliquid / Solana) — integration impossible |
| GMX GLP/GM | Arbitrum only → v2 roadmap |
| PT-Pendle | Expiry date management in aggregator → v2 |

---

## 5. Yield, Fees & Liquidity

### 5.1 Harvest

The `harvest()` function reads the current value of all adapter positions, computes net gains since the previous harvest, applies the performance fee, and optionally triggers rebalancing.

**v1 — Manual execution:** In v1, `harvest()` is called manually by the Guardian multisig. There is no automated keeper. Frequency is determined by the team based on gas cost economics: at low TVL, harvesting too frequently destroys yield. A harvest is triggered when:
- A significant deposit or withdrawal has occurred (capital needs deploying or the buffer needs reconstituting)
- OR the team judges that accumulated gains justify the gas cost

**No claim() needed for Prudent vault:** All Prudent protocols are either ERC-4626 vaults or natively auto-compounding (Aave aUSDC, Morpho vaults, sUSDS, sUSDe, cUSDO, thBILL, sBOLD, scrvUSD, fxSAVE). Their positions appreciate in value automatically — no external `claim()` call is required. This simplifies the harvest function and reduces gas cost significantly.

**Net gain calculation:**
```
gain = Σ adapter[i].totalAssets() (now) − Σ adapter[i].totalAssets() (at last harvest)
```
No claim is needed — the gain is simply the value increase of all positions since the previous snapshot.

**Rebalancing threshold:** To minimize gas costs, adapters are only rebalanced if their current allocation deviates by more than **5% relative** from their target weight (e.g. target = 10% TVL → only rebalance if current < 9.5% or > 10.5%). Small drifts are left untouched.

**Gas cost considerations:**

| Scenario | Gas used | Cost at 10 gwei, ETH $3,000 |
|----------|----------|------------------------------|
| Harvest, no rebalancing (gain snapshot + fee mint) | ~150,000 | ~$0.45 |
| Harvest + rebalancing 2–3 adapters | ~500,000–700,000 | ~$1.50–$2.10 |
| Harvest + full rebalancing 10 adapters | ~1,500,000–2,000,000 | ~$4.50–$6.00 |
| Large withdrawal (proportional exit, 10 adapters) | ~1,500,000–2,000,000 | ~$4.50–$6.00 (paid by user) |

*At 3 gwei (weekend/night): divide all figures by ~3.*

**Profitability threshold:** A harvest with fee mint only (~$0.50 at 10 gwei) becomes profitable as soon as accumulated gains exceed $10 (at 5% performance fee, that means the vault must have earned at least $10 / 5% = $200 in gross yield since last harvest). At $10,000 TVL and 5% APY, that threshold is crossed every ~1.5 days.

### 5.2 Performance Fee

DeFi Lantern charges a **5% performance fee** on net gains, applied at harvest time.

**Implementation:** the fee is never transferred as USDC. Instead, at each harvest, the FeeManager mints new glUSD shares to the treasury proportional to the gain, diluting existing shareholders by 5% of the yield produced. This mechanism aligns treasury interests with user returns — the treasury only earns when users earn.

**Formula:**
```
gain        = totalAssets_after_yield - totalAssets_before_yield
fee_in_usd  = gain × 5%
new_shares  = fee_in_usd / pricePerShare_after_yield
```

The treasury is a Gnosis Safe multisig controlled by the DeFi Lantern team.

**Fee Accrual — continuous separation (no harvest depeg):**

Without a fee accrual mechanism, minting shares to the treasury at harvest time increases `totalSupply` without changing `totalAssets` — causing a minor but observable dip in `pricePerShare` at the moment of harvest.

DeFi Lantern avoids this by maintaining an `accruedFees` variable that tracks the treasury's share of accumulated gains continuously between harvests. `totalAssets()` is defined as net of fees:

```
totalAssets_net = totalAssets_gross − accruedFees
pricePerShare   = totalAssets_net / totalSupply
```

As yield accrues, `accruedFees` grows proportionally (5% of gains). At harvest, minting shares to the treasury converts `accruedFees` into shares and resets it to zero — with zero impact on `pricePerShare`, since the fees were already excluded from `totalAssets_net`.

This guarantees that `pricePerShare` is strictly monotonically non-decreasing under normal yield conditions — a key property for ERC-4626 vault accounting integrity.

### 5.3 Proportional Withdrawal Mechanism

Each glUSD represents a **proportional claim** across all underlying protocols, in line with the current allocation weights. There is no cross-subsidization: one user's Aave position is never used to pay another user's withdrawal.

**Withdrawal flow:**
1. User calls `redeem(shares)`
2. Vault burns glUSD and computes the proportional amount owed from each adapter
3. Vault withdraws simultaneously from each protocol (e.g. 25% from Aave, 20% from Morpho Gauntlet, 15% from Morpho Steakhouse, etc.)
4. Funds from no-cooldown protocols are sent to the user immediately
5. For protocols with a cooldown, the user waits for each protocol's specific delay

**Native token withdrawal option (syrupUSDC):**
For syrupUSDC (cooldown ~5 min), the vault can offer the user their *syrupUSDC tokens directly* instead of waiting for USDC redemption. The user keeps their position and manages it freely on Maple Finance — no queue wait required.

> **No yield cross-subsidization:** the liquidity buffer is a shared vault reserve, not drawn from any individual user's yield allocation. When the buffer covers a withdrawal in full, no other user's position in any protocol is touched. If the withdrawal exceeds the buffer, the shortfall is drawn proportionally from all adapters — each user bears only their own share.

### 5.4 APY Calculation Methodology

DeFi Lantern exposes two complementary APY metrics, each serving a distinct purpose:

**1. Current APY (7-day rolling)**

Measures the vault's recent yield rate, annualized from the last 7 days of share price appreciation:

```
Current APY (7D) = ( (pricePerShare_now / pricePerShare_7D_ago)^(365/7) − 1 ) × 100
```

This metric responds quickly to changes in underlying protocol rates. It can spike or dip temporarily if one underlying protocol adjusts its yield in a short window.

**2. Historical APY (12-month rolling)**

Measures the vault's realized compound performance over the last 12 months:

```
Historical APY (12M) = ( pricePerShare_now / pricePerShare_365D_ago − 1 ) × 100
```

This metric smooths short-term volatility and is the primary figure used for performance reporting. During the protocol's first 12 months of operation, the historical APY is computed from inception date rather than 365 days.

**Implementation notes:**
- Both metrics are derived from `pricePerShare`, which is already **net of the 5% performance fee**. Users always see after-fee returns.
- `pricePerShare` is monotonically non-decreasing under normal yield conditions (it can only be unchanged or higher after each harvest).
- APY figures displayed in the UI are labelled clearly as "7D APY" and "12M APY" to prevent confusion.
- These figures reflect **past performance** and do not constitute a guarantee of future returns.

| Condition | Expected relationship |
|---|---|
| Underlying rates stable | Current APY ≈ Historical APY |
| Underlying rates increased recently | Current APY > Historical APY |
| Underlying rates decreased recently | Current APY < Historical APY |
| Large harvest event | Temporary spike in Current APY |

---

## 6. Governance

### 6.1 GLOW Token

GLOW is the ERC-20Votes governance token of DeFi Lantern. GLOW holders can propose and vote on all protocol parameter changes.

Governable actions:
- `addAdapter(address)` — add a new protocol integration
- `removeAdapter(address)` — deprecate an existing integration
- `setWeights(uint256[])` — update target allocation weights
- `setPerformanceFee(uint256)` — update the fee percentage
- `setTreasury(address)` — update the treasury address

### 6.2 Governor Parameters

| Parameter | Value |
|---|---|
| Voting delay | 1 day (after proposal creation) |
| Voting period | 3 days |
| Quorum | 10% of GLOW total supply |
| Proposal threshold | 1% of GLOW total supply |
| Timelock delay | 48 hours |

### 6.3 Timelock

All governance decisions pass through a 48-hour TimelockController before execution. This gives users time to exit the protocol if they disagree with a passed proposal.

### 6.4 Guardian

A 2-of-3 multisig controlled by the core team holds Guardian rights. The Guardian can:

- Call `pause()` — blocks new deposits and rebalancing
- Call `emergencyExit(address adapter)` — forces immediate withdrawal of all funds from a specific compromised protocol adapter

**emergencyExit flow:**
1. Guardian identifies compromised protocol → calls `emergencyExit(adapter)`
2. Adapter withdraws all funds from the failing protocol — USDC (or tokens) land in the vault
3. Users can immediately withdraw their proportional share of these held funds
4. Governance votes to reallocate remaining capital to other active protocols

> **Non-confiscation guarantee:** The Guardian can never transfer funds to an external address. `emergencyExit` only moves funds into the vault itself — they remain accessible to users through normal withdrawals.

The Guardian **cannot**:
- Withdraw user funds to any external address
- Modify weights or fees
- Add or remove protocols (governance action)

---

## 7. Security

### 7.1 Smart Contract Security

- All core contracts will be audited by a minimum of two independent security firms before mainnet deployment
- A public bug bounty will be launched on Immunefi prior to launch
- Contracts will use OpenZeppelin v5 as the baseline library
- No external calls within the vault core — all protocol interactions are isolated to adapters

### 7.2 Oracle Risk

DeFi Lantern does not introduce its own price oracle — each underlying protocol manages its own oracle infrastructure (Chainlink, Pyth, Redstone). DeFi Lantern's `totalAssets()` function aggregates on-chain values reported by adapters, which read balances directly from protocol contracts.

### 7.3 Emergency Procedures

**Scenario 1 — General anomaly (pause):**
1. Guardian detects anomaly → calls `pause()` → new deposits and rebalancing stopped
2. Users can always withdraw proportionally, even in paused state
3. Governance votes on resolution, subject to 48h Timelock

**Scenario 2 — Hack or failure of an underlying protocol:**
1. Guardian identifies compromised protocol → calls `emergencyExit(adapter)`
2. All funds from the failing protocol are withdrawn and held in the vault
3. Users can immediately withdraw their proportional share of those funds
4. Governance votes to reallocate remaining capital to other active adapters (subject to 48h Timelock)

### 7.4 Secondary Market Acquisition Policy

The secondary market policy covers two distinct situations where DeFi Lantern cannot use a protocol's primary market (official mint/redemption).

**Case 1 — Entry: KYC-gated protocols (thBILL, stcUSD)**
These protocols operate a **permissioned primary market**: direct mint from the issuer requires KYC/AML whitelisting, which a smart contract cannot pass. DeFi Lantern accesses them through their **secondary market** (Uniswap V3), where their tokens trade freely between on-chain participants.

**Case 2 — Urgent exit: sUSDe (Ethena) 7-day cooldown bypass**
sUSDe imposes a **7-day cooldown** for official redemption. If a user requests immediate withdrawal and the Aave v3 liquidity buffer is insufficient, the adapter sells sUSDe directly on Curve (sUSDe/USDC pool) to source USDC without delay. The same slippage (0.5%) and TWAP validation rules apply. If the discount exceeds **1%** below the official NAV, the sale is suspended and a governance alert is emitted.

> **Example — urgent withdrawal with sUSDe:**
> A user requests an 80,000 USDC withdrawal. The Aave v3 buffer holds only $50,000. The vault holds $200,000 of sUSDe. Rather than triggering Ethena's 7-day cooldown, the adapter sells $30,150 of sUSDe on Curve. TWAP 30 min: 1 sUSDe = $0.9985. Official NAV: $1.0000. Discount = 0.15% < 1% → sale authorized. User receives full $80,000 USDC in a single transaction.

#### Entry Rules (Buying)

**Slippage Protection**
- Default maximum slippage: **0.5%** (hardcoded in adapter)
- Configurable by governance vote up to a hard ceiling of 1%
- Transaction reverts automatically if actual slippage would exceed the limit

**Price Impact & Position Sizing**

Price impact is the permanent shift in pool price caused by the order itself — distinct from slippage. For low-liquidity RWA tokens, even modest orders can move the market. DeFi Lantern addresses this through three mechanisms:

1. **Order cap:** maximum single swap is **5% of the adapter's target allocation** per harvest cycle
2. **Partial fill:** if the full order would produce price impact exceeding 0.3%, the order is automatically reduced to fit within that limit; the remainder is deferred to the next harvest cycle
3. **Order splitting:** large positions are distributed across consecutive harvest cycles to minimize cumulative market impact

**Oracle Validation (anti-manipulation)**
Before any DEX swap, the adapter reads the **30-minute TWAP** from the target Uniswap V3 pool:
- If the TWAP deviates more than 0.5% from the protocol's reported NAV: swap is aborted
- Protects against sandwich attacks, flash loan manipulation, and short-term price distortion

**MEV Protection**
Adapter swaps are routed through Flashbots MEV Protect (or equivalent private mempool) to prevent frontrunning and sandwich attacks.

> **Worked example — thBILL harvest cycle:**
> Prudent vault TVL: $10,000,000. Target thBILL allocation: 5% = $500,000.
>
> **① TWAP check:** Adapter reads the USDC/thBILL Uniswap V3 pool over 30 minutes. TWAP: 1 thBILL = $1.0012. NAV reported by Theo Network: $1.0015. Deviation = 0.03% < 0.5% → swap authorized.
>
> **② Order cap:** 5% × $500,000 = **$25,000 max** per harvest cycle.
>
> **③ Price impact:** Pool depth = $2,000,000. Buying $25,000 of thBILL would shift the price by ~1.25% > 0.3% → order automatically reduced to **~$8,000** (the amount that keeps impact below 0.3%).
>
> **④ Outcome:** $8,000 of thBILL acquired per cycle with minimal market impact. Full $500,000 position built over ~62 harvest cycles, each with <0.3% price impact per cycle.

#### No-Liquidity Scenario

If no viable swap route exists within slippage limits:

1. The adapter does **not** revert the full rebalance — the failing allocation is isolated
2. The USDC earmarked for that protocol remains in Aave v3 (generating ~3–5% baseline APY)
3. The vault emits `AdapterAllocationPending(address adapter, uint256 pendingAmount)`
4. At the next harvest, if conditions are met (TWAP within 0.5%, slippage within 0.5%, price impact within 0.3%), the swap is executed. If not, the USDC stays in Aave v3 another cycle.
5. After **3 consecutive harvests** where conditions are not met: `AdapterLiquidityAlert` is emitted and governance is notified for manual review
6. Governance may vote to: (a) extend the waiting period, (b) reduce the target allocation, or (c) remove the adapter entirely

> **No-liquidity example:**
> Suppose the thBILL/USDC pool temporarily dries up (only $50,000 in liquidity). The adapter attempts to deploy $25,000 → estimated slippage 8.5% > 0.5% cap → swap aborted.
>
> The $25,000 earmarked for thBILL stays in Aave v3 at ~4% APY instead. `AdapterAllocationPending` is emitted. The adapter retries on cycles 2 and 3 — still no liquidity. After cycle 3: `AdapterLiquidityAlert` is emitted. Governance reviews and may vote to: reduce thBILL target from 5% to 2%, wait for liquidity to recover, or remove the thBILL adapter entirely.

#### Exit Rules (Selling)

The same slippage and oracle validation rules apply symmetrically on exit:

- If secondary market price falls below NAV by more than **1%**: redemption is halted and an on-chain event is emitted for governance review
- During a user withdrawal: the vault uses the Aave v3 liquidity buffer first — the illiquid adapter allocation is flagged as pending exit
- Extreme illiquidity: Guardian may call `emergencyHold(adapter)` to freeze that adapter's allocation until liquidity recovers — all other adapters remain fully operational

| Risk | Mitigation |
|---|---|
| Slippage on large entry/exit | 0.5% hard cap + partial fill + order splitting |
| Price impact on thin pools | Liquidity depth check + 5% per-cycle order cap |
| TWAP price manipulation | 30-minute TWAP + ≥0.5% deviation abort threshold |
| NAV premium or discount | Oracle comparison + redemption halt mechanism |
| Pool illiquidity on entry | USDC held in Aave → retry logic → governance alert |
| Pool illiquidity on exit | Aave buffer absorbs withdrawal + emergencyHold |
| MEV / sandwich attacks | Private mempool routing via Flashbots |
| Single-protocol concentration | Hard cap at 5% of Prudent vault TVL for exception-tier protocols (thBill) |

---

## 8. Tokenomics

> **Note: tokenomics parameters are indicative and subject to revision.**

### 8.1 GLOW Token

| Parameter | Value |
|---|---|
| Total supply | 100,000,000 GLOW |
| Standard | ERC-20Votes |
| Inflation | None (fixed supply) |

### 8.2 Initial Distribution

| Allocation | % | Amount | Vesting | Rationale |
|---|---|---|---|---|
| **Team (5 founders)** | 20% | 4,000,000 each | 12-month cliff + 24-month linear | Founders cannot sell at launch |
| **Treasury / DAO** | 40% | 40,000,000 | DAO-governed | Funds audits, infrastructure, future development |
| **Community / Liquidity Mining** | 30% | 30,000,000 | 48-month emission to glUSD depositors | Bootstraps adoption, rewards early users |
| **Ecosystem / Grants** | 10% | 10,000,000 | Discretionary, DAO-governed | Integrations, hackathons, partnerships |

### 8.3 GLOW Utility

- **Governance:** vote on all protocol parameters (weights, fees, adapters)
- **Proposal rights:** holding ≥ 1% of supply (1,000,000 GLOW) allows proposing changes
- **Fee sharing (v2):** a portion of performance fees may be redirected to GLOW stakers via governance vote

---

## 9. Roadmap

### 9.1 v1 — Academic MVP (6 weeks)

All strategies are on Ethereum mainnet. Rebalancing is manual (governance vote). No keeper. Protocols with cross-chain tokens are accessed via Architecture 0 only (bridged OFT token bought on ETH — the vault itself never sends assets cross-chain).

| Phase | Milestone | Target |
|---|---|---|
| **Phase 1** | Architecture finalization, IAdapter + Vault skeleton | Week 1 |
| **Phase 2** | AaveAdapter + MorphoAdapter (×2) + unit tests | Week 2 |
| **Phase 3** | All remaining adapters + FeeManager | Week 3 |
| **Phase 4** | Governance contracts (GLOW + Governor + Timelock) | Week 4 |
| **Phase 5** | Integration tests (Foundry fork mainnet), Sepolia deployment | Week 5 |
| **Phase 6** | Frontend (React + wagmi + RainbowKit), final audit, demo | Week 6 |

---

### 9.2 v2 — Production Protocol

**Focus:** automated operations, cross-chain expansion, tokenomics activation.

#### 9.2.1 Cross-Chain Strategy

DeFi Lantern vaults remain anchored on Ethereum mainnet. Cross-chain access is addressed progressively using four architectures, applied in strict order of increasing complexity:

| Architecture | Mechanism | Cost | When to use |
|---|---|---|---|
| **0 — Bridged token on ETH** | Protocol deploys its token on ETH via LayerZero OFT or equivalent. Vault buys it on ETH like any ERC-20. No active bridging from the vault. | Gas only (~$5–15) | Default — always check first. Example: Sierra Money (lzSIERRA on ETH). |
| **1a — Keeper + CCTP** | Off-chain keeper bridges USDC via Circle CCTP v2 (near-free, 2–10s) to Arbitrum / Base / Optimism and deposits into target protocol. Balance is pushed back to ETH via oracle (~1h). | ~$10–30/rebalance | Major EVM L2s with native Circle USDC. |
| **1b — Keeper + Li.Fi** | Keeper queries Li.Fi aggregator (10+ bridges compared in real time) for app-chains without CCTP: Avalanche, HyperEVM, Plasma, Mantle… | ~$15–40/rebalance | Non-CCTP EVM chains. |
| **2 — OVault (LayerZero)** | Satellite contracts on each target chain, governed by the ETH vault via LayerZero messages. Fully decentralized — no keeper required. | Low on-chain | Target architecture for v3. |

**Cross-chain priority by profile:**

| Profile | Architecture |
|---|---|
| Prudent 🛡️ | 100% ETH mainnet — no cross-chain |
| Balanced ⚖️ | 100% ETH mainnet — no cross-chain |
| Dynamic ⚡ | Architecture 0 first → Architecture 1a if protocol is on an EVM L2 |
| Airdrop Hunter 🪂 | Architecture 0 (Sierra Money, already decided) → Architecture 1b for new protocols |

**Bridge failure behavior:** if a bridge swap would exceed the 0.5% slippage limit, or if Li.Fi returns no viable route, the keeper does not execute the cross-chain allocation. The USDC remains in Aave v3 (generating ~3–5% baseline APY) and the allocation is retried at the next harvest cycle. After 3 consecutive failed cycles, an on-chain alert is emitted and governance review is triggered. No NAV impact — `totalAssets()` accurately reflects the Aave fallback position. The APY drag is temporary and proportional to the failed allocation's target weight.

> The cross-chain keeper only makes economic sense above ~$300K–500K TVL on the affected profiles. Below this threshold, keeper gas costs ($130–440/month for 3 protocols) exceed the incremental yield captured.

#### 9.2.2 Other v2 Milestones

- Automated rebalancing via Chainlink Automation or Gelato keeper network
- PT-Pendle integration with automated rollover at expiry
- Performance fee partial redirection to GLOW stakers (governance vote required)
- Public bug bounty on Immunefi
- Third-party audit coverage expansion (minimum two firms pre-mainnet)

---

### 9.3 v3 — Long-Term Vision

- **Decentralized cross-chain (Architecture 2):** LayerZero OVault standard — satellite contracts on Arbitrum, Base, Avalanche governed on-chain by the ETH vault. No keeper required. Users can deposit USDC from any supported chain and receive glUSD shares on their chain via LayerZero OFT.
- **Multi-asset support:** USDT and DAI vaults with independent adapter sets.
- **Expanded RWA coverage:** tokenized credit, private credit, and commodity-backed instruments as on-chain liquidity matures.
- **Governance decentralization:** progressive reduction of Guardian powers as protocol track record builds.

---

## 10. Legal Disclaimer

DeFi Lantern is an experimental, open-source software project developed for academic purposes. It is not a registered financial product or investment vehicle. glUSD shares are not securities. Depositing assets into DeFi Lantern involves significant risks including, but not limited to: smart contract vulnerabilities, oracle failures, underlying protocol failures, liquidity constraints, and regulatory changes.

Users interact with DeFi Lantern at their own risk. The core team provides no guarantee of returns, capital preservation, or uninterrupted access to funds. Past performance of underlying protocols is not indicative of future results.

This document is a draft whitepaper and does not constitute a prospectus, investment advice, or solicitation of any kind.

---

*DeFi Lantern — Whitepaper v0.2 — March 2026*
*This document will be updated as the protocol evolves.*
