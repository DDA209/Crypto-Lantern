// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


/// @title Vault Prudent
/// @author Didier PASCAREL (https://www.linkedin.com/in/didier-pascarel/)
/// @notice This contract is a vault that allows users to deposit USDC and receive shares in return. USDC are deposited in Aave protocol to generate yield.
/// @dev This contract is a vault that allows users to deposit USDC and receive shares in return. It uses the ERC4626 standard.
/// @custom:studywork Final project to be presented for the defense
contract VaultPrudent is ERC4626, ReentrancyGuard {
    /* Errors */
    error NotDao(address sender);
    error AddressNotAllowed(address sender, address badAddress);
    error BadPercentage(bytes name, address sender, uint16 badPercentage);

    /* Events */
    event DaoChanged(address oldDao, address newDao); 
    event FeesBIPSChanged(uint16 oldFeesBIPS, uint16 newFeesBIPS); 
    event LiquidityBufferBIPSChanged(uint16 oldLiquidityBufferBIPS, uint16 newLiquidityBufferBIPS);

    /* State variables */
    /// @notice USDC token
    /// @dev The USDC token contract address
    IERC20 usdc;

    /// @notice Fees percentage
    /// @dev Fees are calculated at harvest time
    uint16 public feesBIPS;

    /// @notice Liquidity buffer percentage
    /// @dev The amount of USDC kept in the vault to absorb impermanent loss, it represent a percentage of deposit TVL
    /// @dev It's rebalanced with harvest
    uint16 public liquidityBufferBIPS;

    /// @notice DAO address
    /// @dev The address of the DAO that manages the vault
    address public dao;
    
    constructor(IERC20 _usdc, address _dao) ERC4626(_usdc) ERC20("Glow Prudent", "glUSD-P") {
        usdc = _usdc;
        dao = _dao;
        feesBIPS = 500;
        liquidityBufferBIPS = 1000; // 10%
    }

    /* Modifiers */

    /// @notice Modifier to check if the caller is the DAO
    /// @dev The caller must be the DAO to call this function
    modifier onlyDAO() {
        require(msg.sender == dao, NotDao(msg.sender));
        _;
    }

        /* View functions */

    /// @notice Returns the total amount of assets in the vault
    /// @dev The total amount of assets is the sum of the assets in the vault and the assets in Aave
    /// @return totalAsset sum of the assets in the vault and the assets in Aave
    /// @inheritdoc IERC4626
    function totalAssets() public view override returns (uint256 totalAsset) {
            uint256 vaultBalance = super.totalAssets();
            uint256 aaveBalance = 0;
        return vaultBalance + aaveBalance;
    }

    /* DAO functions */

        /// @notice Sets the DAO address
    /// @param _dao The address of the DAO
    /// @dev The address of the DAO that manages the vault
    function setDao(address _dao) external onlyDAO {
        require(_dao != address(0) && _dao != dao && _dao != address(this), AddressNotAllowed(msg.sender, _dao));
        
        address oldDao = dao;
        dao = _dao;
        
        emit DaoChanged(oldDao, _dao);
    }

    /// @notice Sets the fees percentage
    /// @param _feesBIPS The fees percentage
    /// @dev The fees percentage is the percentage of the profit that is transferred to the DAO multisig wallet
    function setFeesBIPS(uint16 _feesBIPS) external onlyDAO {
        require(_feesBIPS <= 10000 && _feesBIPS >= 0, BadPercentage(bytes("Fees"), msg.sender, _feesBIPS));
        
        uint16 oldFeesBIPS = feesBIPS;
        feesBIPS = _feesBIPS;
        
        emit FeesBIPSChanged(oldFeesBIPS, _feesBIPS);
    }

    /// @notice Sets the liquidity buffer percentage
    /// @param _liquidityBufferBIPS The liquidity buffer percentage
    /// @dev The liquidity buffer percentage is the percentage of the assets in the vault that is kept in the vault to absorb impermanent loss
    function setLiquidityBufferBIPS(uint16 _liquidityBufferBIPS) external onlyDAO {
        require(_liquidityBufferBIPS <= 10000 && _liquidityBufferBIPS >= 0, BadPercentage(bytes("Liquidity buffer"), msg.sender, _liquidityBufferBIPS));
        
        uint16 oldLiquidityBufferBIPS = liquidityBufferBIPS;
        liquidityBufferBIPS = _liquidityBufferBIPS;
        
        emit LiquidityBufferBIPSChanged(oldLiquidityBufferBIPS, _liquidityBufferBIPS);
    }

    function harvest() external onlyDAO {
        // TODO: code the function
        bufferRebalancing(0);
    }

    function bufferRebalancing(uint256 amount) internal view returns (uint256 strategyShare) {
        // TODO : code the function
        uint256 bufferShare = amount * liquidityBufferBIPS / 10000; // 10%
        strategyShare = amount - bufferShare; // 90%
        return strategyShare;
    }

    /* External functions */

    /// @notice Deposits USDC into the vault and returns shares in return
    /// @param usdcAmount The amount of USDC to deposit
    /// @param receiver The address to receive the shares
    /// @return glUsdP The amount of shares received
    /// @inheritdoc IERC4626
    function deposit(
        uint256 usdcAmount,
        address receiver
    ) public override returns (uint256 glUsdP) {
        // TODO: rebalancing buffer with buffershares
        uint256 strategyShare =bufferRebalancing(usdcAmount);
        
        // TODO: deposit strategyShare in aave

        glUsdP = super.deposit(usdcAmount, receiver);

        return glUsdP;
    }

    /// @notice Redeems shares from the vault and returns assets in return
    /// @param glUsdPAmount The amount of shares to redeem
    /// @param receiver The address to receive the assets
    /// @param owner The address of the owner
    /// @return assets The amount of assets received
    /// @inheritdoc IERC4626
    function redeem(uint256 glUsdPAmount, address receiver, address owner) public override nonReentrant returns (uint256 assets) {
        // TODO: withdraw from aave
        // Count fees 5% of profit transfered to DAO multisig wallet in glUSD-P
        assets = super.redeem(glUsdPAmount, receiver, owner);
        return assets;
    }
}