// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Interface for an adapter
/// @dev The adapter is used to invest
/// @custom:todo Create interface file IAdapter
interface IAdapter {
    function getInvestedAssets() external view returns (uint256);
    function invest(uint256 asset) external;
    function divest(uint256 asset) external;
    function isLanternAdaptor() external view returns (bool);
}

/// @title Vault Prudent glUSDP
/// @author Didier PASCAREL (https://www.linkedin.com/in/didier-pascarel/)
/// @notice 
/// @dev 
/// @custom:studywork Final project to be presented for the defense
contract VaultPrudentGlUSDP is ERC4626, ReentrancyGuard {
    /* Errors A-Z sorted*/
    error AddressNotAllowed(address sender, address badAddress);
    error BadPercentage(bytes name, address sender, uint16 badPercentage);
    error IndexOutOfBounds(uint256 index, uint256 length);
    error NotAmountZero();
    error NotDao(address sender);
    error NotEnoughAssets(bytes name, uint256 amount, uint256 bufferTotalAssets);
    error NoDataFound(bytes data);

    /* Events A-Z sorted*/
    event DaoChanged(address oldDao, address newDao); 
    event FeesBIPSChanged(uint16 oldFeesBIPS, uint16 newFeesBIPS); 
    event LiquidityBufferBIPSChanged(uint16 oldLiquidityBufferBIPS, uint16 newLiquidityBufferBIPS);

    /* State variables */
    /// @notice USDC token
    /// @dev The USDC token contract address
    IERC20 usdc;

    struct Strategy {
        IAdapter adapter;
        uint16 repatitionBIPS;
    }

    /// @notice Array of strategies
    /// @dev The array of strategies that are used to invest
    Strategy[] public strategies;

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
 
    /* Modifiers */

    /// @notice Modifier to check if the caller is the DAO
    /// @dev The caller must be the DAO to call this function
    modifier onlyDAO() {
        require(msg.sender == dao, NotDao(msg.sender));
        _;
    }

    constructor(IERC20 _usdc, address _dao) ERC4626(_usdc) ERC20("Glow Prudent", "glUSD-P") {
        usdc = _usdc;
        dao = _dao;
        feesBIPS = 500; // 5%
        liquidityBufferBIPS = 1000; // 10%
    }

    /* View functions */

    /// @notice Returns the total amount of assets in the vault as buffer
    /// @dev The total amount of assets is the sum of the assets in the vault and the assets invested
    /// @return totalAsset sum of the assets in the vault and the assets invested
    function getBufferTotalAssets() public view returns(uint256 bufferTotalAssets) {
        bufferTotalAssets = usdc.balanceOf(address(this));
        return bufferTotalAssets;
    }

    /* DAO functions */

    /// @notice Returns the total amount of assets in the vault including invested assets and 
    /// @dev The total amount of assets is the sum of the assets in the vault and the assets invested
    /// @return totalAsset sum of the assets in the vault and the assets invested
    /// @inheritdoc IERC4626
    function totalAssets() public view override returns (uint256 totalAsset) {
        totalAsset = super.totalAssets();
        for (uint256 i = 0; i < strategies.length; i++) {
            totalAsset += strategies[i].adapter.getInvestedAssets();
        }
        return totalAsset;
    }

    /// @notice Defines the strategies.
    /// @param _newStrategies The new strategies. Attempeted a array of strategies with struct {address adapter, uint16 repatitionBIPS} where adapter is the smart contract address of the adapter and repatitionBIPS is the percentage * 100 of the assets to invest in the adapter. The sum of all repatitionBIPS must be exactly 10000.
    /// eg. [{0xa123b456C789d012E345f67A901b234C567d890, 5417}, {0xb234c567d890a123b456C789d012E345f67A901b, 4583}, ...]
    /// @dev The strategies are used to invest. The sum of all repatitionBIPS must be exactly 10000.
    function defineStrategies(Strategy[] calldata _newStrategies) external onlyDAO {
        require(_newStrategies.length > 0, NoDataFound(bytes("Adapters")));
        uint16 totalRepartitionBIPS = 0;
        for (uint256 i = 0; i < _newStrategies.length; i++) {
            require(_newStrategies[i].repatitionBIPS <= 10000 && _newStrategies[i].repatitionBIPS > 0, BadPercentage(bytes("Repartition"), msg.sender, _newStrategies[i].repatitionBIPS));
            require(IAdapter(_newStrategies[i].adapter).isLanternAdaptor(), AddressNotAllowed(msg.sender, address(_newStrategies[i].adapter)));

            totalRepartitionBIPS += _newStrategies[i].repatitionBIPS;
        }
        require(totalRepartitionBIPS == 10000, BadPercentage(bytes("Repartition"), msg.sender, totalRepartitionBIPS));
        
        strategies = _newStrategies;
    }


    /// @notice Sets the DAO address
    /// @param _dao The address of the DAO
    /// @dev The address of the DAO that manages the vault
    function setDAOAddress(address _dao) external onlyDAO {
        require(_dao != address(0) && _dao != dao && _dao != address(this), AddressNotAllowed(msg.sender, _dao));
        
        address oldDao = dao;
        dao = _dao;
        
        emit DaoChanged(oldDao, _dao);
    }

    /// @notice Sets the fees percentage
    /// @param _feesBIPS The fees percentage
    /// @dev The fees percentage is the percentage of the profit that is transferred to the DAO multisig wallet
    /// @custom:todo Check code
    function setFeesBIPS(uint16 _feesBIPS) external onlyDAO {
        require(_feesBIPS <= 10000 && _feesBIPS >= 0, BadPercentage(bytes("Fees"), msg.sender, _feesBIPS));
        
        uint16 oldFeesBIPS = feesBIPS;
        feesBIPS = _feesBIPS;
        
        emit FeesBIPSChanged(oldFeesBIPS, _feesBIPS);
    }

    /// @notice Sets the liquidity buffer percentage
    /// @param _liquidityBufferBIPS The liquidity buffer percentage
    /// @dev The liquidity buffer percentage is the percentage of the assets in the vault that is kept in the vault to absorb impermanent loss
    /// @custom:todo Check code
    function setLiquidityBufferBIPS(uint16 _liquidityBufferBIPS) external onlyDAO {
        require(_liquidityBufferBIPS <= 10000 && _liquidityBufferBIPS >= 0, BadPercentage(bytes("Liquidity buffer"), msg.sender, _liquidityBufferBIPS));
        
        uint16 oldLiquidityBufferBIPS = liquidityBufferBIPS;
        liquidityBufferBIPS = _liquidityBufferBIPS;
        
        emit LiquidityBufferBIPSChanged(oldLiquidityBufferBIPS, _liquidityBufferBIPS);
    }

    /// @custom:todo write all code
    function harvest() external onlyDAO {
        // 1. Claim
        // 2. 
        // TODO: code the function
        rebalance();
    }

    /// @custom:todo write all code
    function rebalance() public onlyDAO  {
        // TODO : code the function
    }
    /* External functions */

    /// @notice Deposits USDC into the vault and returns shares in return
    /// @param assetAmount The amount of USDC to deposit
    /// @param receiver The address to receive the shares
    /// @return glUSDP The amount of shares received
    /// @inheritdoc IERC4626
    /// @custom:todo Invest in adapters according the strategy and rebalancing liquidity buffer
    function deposit(
        uint256 assetAmount,
        address receiver
    ) public override returns (uint256 glUSDP) {
        require(strategies.length > 0, NoDataFound(bytes("Adapters")));
        require(assetAmount > 0, NotAmountZero());
        require(receiver != address(0), AddressNotAllowed(msg.sender, receiver));

        glUSDP = super.deposit(assetAmount, receiver); // giving shares to the user
        // Eg.      100     =    1_000    *   1_000    /   10_000
        uint256 amountForBuffer = assetAmount * liquidityBufferBIPS / 10000;
        // Eg.      900     =    1_000    -   100
        uint256 amountToInvest = assetAmount - amountForBuffer;

        if (amountToInvest > 0) { 
            for (uint256 i = 0; i < strategies.length; i++) {
                // Eg.      900     =       900     *   10000   /   10000
                uint256 amountForStrategy = uint256(amountToInvest) * strategies[i].repatitionBIPS / 10000;
                if (amountForStrategy > 0) {
                    usdc.transfer(address(strategies[i].adapter), amountForStrategy);
                    strategies[i].adapter.invest(amountForStrategy);
                }
            }   
        }

        return glUSDP;
    }

    /// @notice withdraw asset from the vault and returns shares in return. We use the liquidity buffer to repay users limited to the liquidity buffer amount. No withdraw (for now) from adapters
    /// @param assetAmount The amount of USDC to withdraw
    /// @param receiver The address to receive the assets
    /// @param owner The address of the owner
    /// @return assets The amount of assets received
    /// @inheritdoc IERC4626
    /// @custom:todo write all code
    function withdraw(uint256 assetAmount, address receiver, address owner) public override nonReentrant returns (uint256 assets) {
        require(assetAmount > 0, NotAmountZero());
        require(receiver != address(0), AddressNotAllowed(msg.sender, receiver));
        require(owner != address(0), AddressNotAllowed(msg.sender, owner));
        require(assetAmount <= usdc.balanceOf(address(this)), NotEnoughAssets(bytes("Withdraw"), assetAmount, usdc.balanceOf(address(this))));
        // TODO: withdraw from liquidity buffer
        assets = super.withdraw(assetAmount, receiver, owner);
        return assets;
    }
}