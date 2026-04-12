// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "../interfaces/IAdapter.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


/// @title MockAdapter
/// @notice Contrat de test pour simuler un protocole externe (Aave, Compound, etc.)
contract MockAdapter is IAdapter, ERC165 {
    using SafeERC20 for IERC20;
    
    IERC20 public asset;

    address public vault;
    uint256 public investedAssets; // USDC

    constructor(address _asset, address _vault) {
        asset = IERC20(_asset); // aUSDC
        vault = _vault;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IAdapter).interfaceId || super.supportsInterface(interfaceId);
    }

    function getInvestedAssets() external view returns (uint256) {
        return investedAssets;
    }

    function invest(uint256 amount) external {
        investedAssets += amount;
    }

    function divest(uint256 amount) external {
        require(investedAssets >= amount, "Not enough assets");
        asset.safeTransfer(vault, amount);
        investedAssets -= amount;
    }

    // --- Tests funcitons ---
    
    // Permet de simuler un profit ou une perte
    function setMockAssets(uint256 amount) external {
        investedAssets = amount;
    }
}