// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title IAdapter
/// @author Didier PASCAREL (https://www.linkedin.com/in/didier-pascarel/)
/// @notice Interface for an adapter
/// @dev The adapter is used to invest
/// @custom:studywork Final project to be presented for the defense
interface IAdapter is IERC165 {
    /* Errors */

    /// @notice Error thrown when the caller is not the vault
    error NotVault(address sender);

    /* Events */

    /// @notice Emitted when assets are invested into the adapter
    /// @dev The assets are invested into the adapter
    /// @param vault The address of the vault who invested the assets
    /// @param assets The amount of assets invested
    event Invest(address indexed vault, uint256 assets);

    /// @notice Emitted when assets are divested from the adapter
    /// @dev The assets are divested from the adapter
    /// @param vault The address of the vault who divested the assets
    /// @param assets The amount of assets divested
    event Divest(address indexed vault, uint256 assets);
    
    /// @notice Emitted when assets are received by the adapter
    /// @dev The assets are received by the adapter
    /// @param sender The address of the sender
    event DepositReceived(address indexed sender);
    
    /* Functions */

    /// @notice Returns the total amount of assets invested in the adapter
    /// @return The total amount of assets invested in the adapter
    /// @dev The total amount of assets invested in the adapter
    function getInvestedAssets() external view returns (uint256);
    
    /// @notice Invest assets into the adapter
    /// @dev The assets are invested in the adapter
    /// @param asset The amount of assets to invest
    function invest(uint256 asset) external;
    
    /// @notice Divest assets from the adapter
    /// @dev The assets are divested from the adapter
    /// @param asset The amount of assets to divest
    function divest(uint256 asset) external;   
}
