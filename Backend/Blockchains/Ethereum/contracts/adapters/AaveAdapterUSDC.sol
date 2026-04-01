// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";

/// @title AaveAdapterUSDC
/// @author Didier PASCAREL (https://www.linkedin.com/in/didier-pascarel/)
/// @notice This contract is an adapter for Aave protocol
/// @dev This contract is an adapter for Aave protocol
/// @custom:studywork Final project to be presented for the defense
contract AaveAdapterUSDC {
/* Errors */
error NotVault(address sender);
    /* Events */
    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 assets, uint256 shares);

    IERC20 public usdc;
    IERC20 public aUSDC;
    IPool public aavePool;

    address public vault;

    bool public isLanternAdaptor = true;

    /* Modifiers */
    modifier onlyVault() {
        require(msg.sender == vault, NotVault(msg.sender));
        _;
    }
    constructor(address _usdc, address _aUSDC, address _aavePool, address _vault) {
        usdc = IERC20(_usdc);
        aUSDC = IERC20(_aUSDC); // 0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c https://aave.com/docs/resources/addresses
        aavePool = IPool(_aavePool); // 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 https://aave.com/docs/resources/addresses
        vault = _vault;
    }


    /* View functions */
    function getInvestedAssets() external view onlyVault returns (uint256) {
        return aUSDC.balanceOf(address(this));

    }

    /* Strategy functions */
    /// @notice Invest all USDC in Aave protocol
    /// @custom:reference IPool supply()
    function invest(uint256 usdcAmount) external onlyVault {
        usdc.approve(address(aavePool), usdcAmount);
        aavePool.supply(address(usdc), usdcAmount, address(this), 0);
    }

    /// @notice Withdraws assets from the vault
    /// @param usdcAmount The usdcAmount of assets to withdraw
    /// @custom:reference IPool withdraw()
    function divest(uint256 usdcAmount) external onlyVault {
        uint256 withdrawn = aavePool.withdraw(address(usdc), usdcAmount, address(this));
        usdc.transfer(vault, withdrawn);
    }

}