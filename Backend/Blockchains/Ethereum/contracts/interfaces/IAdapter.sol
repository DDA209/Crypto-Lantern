// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title IAdapter
/// @author Didier PASCAREL (https://www.linkedin.com/in/didier-pascarel/)
/// @notice Interface for an adapter
/// @dev The adapter is used to invest
/// @custom:studywork Final project to be presented for the defense
interface IAdapter {
    /* Errors */

    /// @notice Error thrown when the caller is not the vault
    error NotVault(address sender);

    /* Events */

    /// @notice Emitted when assets are invested into the adapter
    /// @dev The assets are invested into the adapter
    /// @param user The address of the user who invested the assets
    /// @param assets The amount of assets invested
    event Invest(address indexed user, uint256 assets);
    
    /// @notice Emitted when assets are divested from the adapter
    /// @dev The assets are divested from the adapter
    /// @param user The address of the user who divested the assets
    /// @param assets The amount of assets divested
    event Divest(address indexed user, uint256 assets);
    
    /* Functions */

    function supportsInterface(bytes4 interfaceId) external view returns (bool);

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
    
    /// @notice Returns true if the adapter is a Lantern adaptor
    /// @dev The adapter is a Lantern adaptor if it is a valid adaptor
    /// @return true if the adapter is a Lantern adaptor, false otherwise
    function isLanternAdaptor() external view returns (bool);
}
