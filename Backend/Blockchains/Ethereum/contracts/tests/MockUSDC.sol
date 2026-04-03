// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USDC", "USDC") {}

    /**
     * @dev Permet de créer des jetons à partir de rien pour les tests.
     * @param to L'adresse qui recevra les jetons.
     * @param amount Le montant (en incluant les décimales).
     */
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    /**
     * @dev L'USDC réel a 6 décimales, on surcharge donc la fonction par défaut (18).
     */
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}