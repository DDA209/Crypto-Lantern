// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../interfaces/IAdapter.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockAdapter is IAdapter, ERC165 {
    using SafeERC20 for IERC20;
    
    IERC20 public usdc; // L'actif sous-jacent
    address public vault;
    uint256 public simulatedInvestedAmount; 

    constructor(address _usdc, address _vault) {
        usdc = IERC20(_usdc);
        vault = _vault;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IAdapter) returns (bool) {
        return interfaceId == type(IAdapter).interfaceId || super.supportsInterface(interfaceId);
    }

    /// @notice Retourne la valeur actuelle (Capital + Profit simulé)
    function getInvestedAssets() external view returns (uint256) {
        return simulatedInvestedAmount;
    }

    /// @notice Reçoit les USDC du Vault
    function invest(uint256 amount) external {
        // Dans votre Vault, le safeTransfer a déjà eu lieu. 
        // L'adaptateur possède maintenant les USDC physiquement.
        simulatedInvestedAmount += amount;
    }

    /// @notice Renvoie les USDC au Vault
    function divest(uint256 amount) external {
        require(simulatedInvestedAmount >= amount, "Not enough assets");
        simulatedInvestedAmount -= amount;
        
        // CRUCIAL : Il faut renvoyer les USDC au Vault !
        usdc.safeTransfer(vault, amount);
    }

    /// @notice FONCTION DE DEBUG : Simule l'arrivée de rendement (Yield)
    /// @param profit Le montant de profit à ajouter artificiellement
    function simulateYield(uint256 profit) external {
        simulatedInvestedAmount += profit;
        // On n'a pas besoin de recevoir de vrais USDC ici, 
        // on simule juste que la valeur a grimpé on-chain.
    }
}