// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    /**
     * @dev Mints new tokens and sends them to the specified address.
     * @param to The address to send the tokens to.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    /**
     * @dev Returns the number of decimals of the token.
     * @return The number of decimals of the token.
     */
 function decimals() public view override returns (uint8) { return _decimals; }
}