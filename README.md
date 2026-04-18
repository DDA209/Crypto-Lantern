# 🏮 DeFi Lantern

> **DeFi Lantern** est un protocole décentralisé d'agrégation de rendements (Yield Aggregator) pour stablecoins. Un seul dépôt USDC pour une exposition diversifiée aux meilleurs rendements de la DeFi.

[![Website](https://img.shields.io/badge/Website-cryptoluciole.com-28B092?style=flat-square)](https://www.cryptoluciole.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Context](https://img.shields.io/badge/Contexte-Projet_Certification_Alyra-purple?style=flat-square)]()

## 📖 À propos du projet

Ce projet a été développé dans le cadre d'un projet final de certification Web3.

DeFi Lantern permet aux utilisateurs de déposer leurs stablecoins (USDC) et de laisser le protocole optimiser le rendement. Le projet repose sur des Vaults au standard **ERC4626**. Dans cette version de présentation (Beta/Testnet), le protocole s'appuie sur le profil de risque :

- 🛡️ **Prudent (glUSD-P)** : Sécurité absolue, utilisant exclusivement le protocole Tier-1 **Aave V3**.

_Note : L'architecture est conçue pour être évolutive vers du multi-stratégies (Compound, Morpho, etc.) sur Mainnet, bien que cette itération soit restreinte à un environnement de test (Sepolia)._

## 🏗️ Architecture du Protocole

Le projet illustre la maîtrise des concepts avancés du Web3 :

- **Architecture Modulaire :** Séparation entre le coffre (Vault) et les stratégies (Adapters) pour une évolutivité sans migration de liquidité.
- **Standards ERC :** Implémentation stricte des normes ERC20, ERC4626 (Tokenized Vaults) et ERC165 (Standard Interface Detection).
- **Gestion des Rôles (RBAC) :** Séparation des pouvoirs entre la `Team` (gestion technique, récolte) et la `DAO` (gouvernance, stratégies) avec un système de transfert de propriété sécurisé en deux étapes (Propose/Accept).
- **Traçabilité On-Chain :** Émission d'événements (`Harvest`, `Rebalance`, etc.) pour permettre l'indexation et la construction de tableaux de bord financiers sur le front-end.

```mermaid
flowchart TB
 subgraph Acteurs["Acteurs"]
        U(["Utilisateur"])
        D(["DAO"])
        T(["Team"])
  end
 subgraph Frontend["🖥️ Application Web (Vercel / Next.js)"]
        UI["Interface Crypto Lantern <br> Wagmi / AppKit"]
  end
 subgraph Blockchain["⛓️ Smart Contracts (Sepolia)"]
        V["VaultPrudentGlUSDP <br> Standard ERC-4626"]
        A["AaveAdapterUSDC <br> Validé via ERC-165"]
  end
 subgraph DeFi["🌐 Protocole DeFi"]
        AAVE[("Pool Aave V3")]
  end
    V -- Délègue les fonds / Demande retrait --> A
    U -- Dépôt (USDC) --> UI
    U -- "Burn (glUSD-P)" --> UI
    UI -- Mint (glUSD-P) --> U
    UI -- Retrait (USDC) --> U
    D -- Rebalance / Modifie : Frais, Buffer, Adapter --> UI
    T -- Déclenche Harvest --> UI
    UI -- Appels de fonctions & Transactions --> V
    A -- Supply (Dépôt USDC) --> AAVE
    AAVE -. Génère Rendement .-> A
    V -. Désinvestissement auto si Buffer insuffisant .-> A

     U:::Aqua
     D:::Rose
     T:::Peach
     UI:::Sky
     V:::Sky
     A:::Sky
     AAVE:::Ash
    classDef Rose stroke-width:1px, stroke-dasharray:none, stroke:#FF5978, fill:#FFDFE5, color:#8E2236
    classDef Aqua stroke-width:1px, stroke-dasharray:none, stroke:#46EDC8, fill:#DEFFF8, color:#378E7A
    classDef Peach stroke-width:1px, stroke-dasharray:none, stroke:#FBB35A, fill:#FFEFDB, color:#8F632D
    classDef Ash stroke-width:1px, stroke-dasharray:none, stroke:#999999, fill:#EEEEEE, color:#000000
    classDef Sky stroke-width:1px, stroke-dasharray:none, stroke:#374D7C, fill:#E2EBFF, color:#374D7C
    style D color:#D50000
    style UI color:#374D7C,fill:#E2EBFF,stroke:#374D7C
    linkStyle 1 stroke:#00C853,fill:none
    linkStyle 2 stroke:#D50000,fill:none
    linkStyle 3 stroke:#00C853,fill:none
    linkStyle 4 stroke:#D50000,fill:none
```

## 📂 Structure du Monorepo

Le projet est divisé en deux entités distinctes :

- **Backend** : Smart Contracts Solidity (Vaults ERC4626, Adapters). Propulsé par Hardhat.
- **Frontend** : DApp Web3 Next.js. Tableaux de bord Investisseurs, Administration Team et Gouvernance DAO.

## 🔗 Liens Utiles

- [Site Officiel & DApp](https://www.cryptoluciole.com/)
- [Protocole Vulgarisé](https://www.cryptoluciole.com/protocole-vulgarise.html)
- [Whitepaper](https://www.cryptoluciole.com/#whitepaper)

⚖️ Avertissement
Projet à but académique et expérimental. Les smart contracts n'ont pas été audités par des professionnels.
