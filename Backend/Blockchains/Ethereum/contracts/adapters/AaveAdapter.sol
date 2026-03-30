// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";


contract AaveAdapter {
/* Errors */
error NotVault(address sender);

    /* Events */
    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 assets, uint256 shares);

    IERC20 public usdc;
    IERC20 public aUSDC;
    IPool public aavePool;
    address public vault;

    constructor(address _usdc, address _aUSDC, address _aavePool, address _vault) {
        usdc = IERC20(_usdc);
        aUSDC = IERC20(_aUSDC); // 0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c https://aave.com/docs/resources/addresses
        aavePool = IPool(_aavePool); // 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 https://aave.com/docs/resources/addresses
        vault = _vault;
    }

    /* Modifiers */
    modifier onlyVault() {
        require(msg.sender == vault, NotVault(msg.sender));
        _;
    }

    /* View functions */
    function getInvestedAssets() external view returns (uint256) {
        return aUSDC.balanceOf(address(this));
    }

    /* External functions */
    function invest() external onlyVault {
        uint256 amount = usdc.balanceOf(address(this));
        usdc.approve(address(aavePool), amount);
        aavePool.supply(address(usdc), amount, address(this), 0);
    }

    function withdraw(uint256 amount) external onlyVault {
        uint256 withdrawn = aavePool.withdraw(address(usdc), amount, address(this));
        usdc.transfer(vault, withdrawn);
    }

}