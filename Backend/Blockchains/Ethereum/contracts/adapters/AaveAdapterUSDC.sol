// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import {IAdapter} from "../interfaces/IAdapter.sol";

/// @title AaveAdapterUSDC
/// @author Didier PASCAREL (https://www.linkedin.com/in/didier-pascarel/)
/// @notice This contract is an adapter for Aave protocol
/// @dev This contract is an adapter for Aave protocol
/// @custom:studywork Final project to be presented for the defense
contract AaveAdapterUSDC is IAdapter, ERC165{
    using SafeERC20 for IERC20;

    /* State variables */

    IERC20 public usdc;
    IERC20 public aUSDC;
    IPool public aavePool;

    address public vault;

    /* Modifiers */

    /// @notice Modifier to check if the caller is the vault
    /// @dev The caller must be the vault to call this function
    modifier onlyVault() {
        require(msg.sender == vault, NotVault(msg.sender));
        _;
    }

    /// @notice Constructor for the AaveAdapterUSDC contract
    /// @param _usdc The USDC token contract address
    /// @param _aUSDC The aUSDC token contract address
    /// @param _aavePool The Aave pool contract address
    /// @param _vault The vault contract address
    constructor(address _usdc, address _aUSDC, address _aavePool, address _vault){
        usdc = IERC20(_usdc);
        aUSDC = IERC20(_aUSDC); // 0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c https://aave.com/docs/resources/addresses
        aavePool = IPool(_aavePool); // 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2 https://aave.com/docs/resources/addresses
        vault = _vault;
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IAdapter).interfaceId || super.supportsInterface(interfaceId);
    }

    /* View functions */

    /// @inheritdoc IAdapter
    function getInvestedAssets() external view returns (uint256 investedAssets) {
        investedAssets = aUSDC.balanceOf(address(this));
        return investedAssets;
    }

    /* Strategy functions */

    /// @inheritdoc IAdapter
    function invest(uint256 usdcAmount) external onlyVault {
        require(usdcAmount > 0, "Amount must be greater than 0");

        usdc.forceApprove(address(aavePool), usdcAmount);
        aavePool.supply(address(usdc), usdcAmount, address(this), 0);

        emit Invest(msg.sender, usdcAmount);
    }

    /// @inheritdoc IAdapter
    function divest(uint256 usdcAmount) external onlyVault {
        require(usdcAmount > 0, "Amount must be greater than 0");

        uint256 withdrawn = aavePool.withdraw(address(usdc), usdcAmount, address(this));
        usdc.safeTransfer(vault, withdrawn);

        emit Divest(msg.sender, usdcAmount);
    }
}