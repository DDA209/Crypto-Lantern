// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../interfaces/IAdapter.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MockAdapter
/// @notice Contrat de test pour simuler un protocole externe (Aave, Compound, etc.)
contract MockAdapter is IAdapter, ERC165 {
    
    uint256 public investedAssets;
    address public vault;
    IERC20 public asset;

    constructor(address _asset, address _vault) {
        asset = IERC20(_asset);
        vault = _vault;
    }

    // Indispensable pour que le Vault accepte d'ajouter cet adaptateur
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IAdapter) returns (bool) {
        return interfaceId == type(IAdapter).interfaceId || super.supportsInterface(interfaceId);
    }

    function getInvestedAssets() external view returns (uint256) {
        return investedAssets;
    }

    // Simule l'investissement : on reçoit l'USDC du Vault
    function invest(uint256 amount) external {
        investedAssets += amount;
        // Dans un vrai test, on pourrait transférer les fonds, 
        // mais ici on simule juste la comptabilité
    }

    // Simule le retrait : on "rend" l'USDC au Vault
    function divest(uint256 amount) external {
        require(investedAssets >= amount, "Not enough assets");
        investedAssets -= amount;
    }

    // Indispensable pour ton interface IAdapter
    function isLanternAdaptor() external pure returns (bool) {
        return true;
    }

    // --- FONCTIONS DE TEST (GOD MODE) ---
    
    // Permet de simuler un profit ou une perte d'un coup de baguette magique
    function setMockAssets(uint256 amount) external {
        investedAssets = amount;
    }
}