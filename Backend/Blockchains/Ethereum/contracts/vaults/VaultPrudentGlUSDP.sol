// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IAdapter} from "../interfaces/IAdapter.sol";

/// @title Vault Prudent glUSDP
/// @author Didier PASCAREL (https://www.linkedin.com/in/didier-pascarel/)
/// @notice 
/// @dev 
/// @custom:studywork Final project to be presented for the defense
contract VaultPrudentGlUSDP is ERC4626, ReentrancyGuard{
    using SafeERC20 for IERC20;

    /* Errors A-Z sorted*/
    error AddressNotAllowed(address sender, address badAddress);
    error BadAmount(bytes name, uint256 amount, uint256 bufferTotalAssets);
    error BadPercentage(bytes name, address sender, uint16 badPercentage);
    error IndexOutOfBounds(uint256 index, uint256 length);
    error NotADao(address sender);
    error NotAmountZero();
    error NoDataFound(bytes data);

    /* Events A-Z sorted*/
    event DaoChanged(address oldDao, address newDao); 
    event FeesBIPSChanged(uint16 oldFeesBIPS, uint16 newFeesBIPS); 
    event ForceDivest(uint256 amount, uint256 totalAmountToDivest, uint256 remainingToDivest);
    event Harvest(uint256 profit, uint256 fees, uint256 sharesToMint, uint256 lastTotalAssets);
    event LiquidityBufferBIPSChanged(uint16 oldLiquidityBufferBIPS, uint16 newLiquidityBufferBIPS);
    event Rebalance(bool force, uint256 currentTotalAssets, uint256 targetBuffer, uint256 targetInvestedAmount, uint256 currentInvestedAmount, uint256[] strategyToInvest);
    event StrategiesChanged(Strategy[] newStrategies);
    event TotalAssetsChanged(uint256 totalAssets);

    /* State variables */
    struct Strategy {
        IAdapter adapter;
        uint16 repatitionBIPS; // 6000 = 60.00%
        uint16 deltaBIPS; // 100 = 1.00%
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
    address public daoAddress;

    /// @notice Last total assets
    /// @dev The last total assets of the vault
    uint256 public lastTotalAssets;

    /// @notice Total deposit
    /// @dev The total deposit of the vault

    /// @notice Share price
    /// @dev The price of one share
    uint256 public sharePrice;

    /* Modifiers */

    /// @notice Modifier to check if the caller is the DAO
    /// @dev The caller must be the DAO to call this function
    modifier onlyDAO() {
        require(msg.sender == daoAddress, NotADao(msg.sender));
        _;
    }

    constructor(IERC20 _usdc, address _daoAddress, uint16 _feesBIPS, uint16 _liquidityBufferBIPS) ERC4626(_usdc) ERC20("Glow Prudent", "glUSD-P") {
        daoAddress = _daoAddress;
        feesBIPS = _feesBIPS;
        liquidityBufferBIPS = _liquidityBufferBIPS;
    }

    /* View functions */

    /// @notice Returns the total amount of assets in the vault as buffer
    /// @dev The total amount of assets is the sum of the assets in the vault and the assets invested
    /// @return bufferTotalAssets sum of the assets in the vault and the assets invested
    function getBufferTotalAssets() public view returns(uint256 bufferTotalAssets) {
        bufferTotalAssets = IERC20(asset()).balanceOf(address(this));

        return bufferTotalAssets;
    }

    /// @notice Returns the total amount of assets in the vault including invested assets and 
    /// @dev The total amount of assets is the sum of the assets in the vault and the assets invested
    /// @return totalAsset sum of the assets in the vault and the assets invested
    /// @inheritdoc IERC4626
    function totalAssets() public view override returns (uint256 totalAsset) {
        uint256 usdcBalance = IERC20(asset()).balanceOf(address(this));
        
        for (uint256 i = 0; i < strategies.length; i++) {
            usdcBalance += strategies[i].adapter.getInvestedAssets();
        }
        
        return usdcBalance;
    }

    /* DAO functions */

    
    /// @notice Sets the DAO address
    /// @param _daoAddress The address of the DAO
    /// @dev The address of the DAO that manages the vault
    function setDAOAddress(address _daoAddress) external onlyDAO {
        require(_daoAddress != address(0) && _daoAddress != daoAddress && _daoAddress != address(this), AddressNotAllowed(msg.sender, _daoAddress));
        
        address oldDao = daoAddress;
        daoAddress = _daoAddress;
        
        emit DaoChanged(oldDao, _daoAddress);
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

    /// @notice Defines the strategies.
    /// @param _newStrategies The new strategies. Attempeted a array of strategies with struct {address adapter, uint16 repatitionBIPS} where adapter is the smart contract address of the adapter and repatitionBIPS is the percentage * 100 of the assets to invest in the adapter. The sum of all repatitionBIPS must be exactly 10000.
    /// eg. [{0xa123b456C789d012E345f67A901b234C567d890, 5417}, {0xb234c567d890a123b456C789d012E345f67A901b, 4583}, ...]
    /// @dev The strategies are used to invest. The sum of all repatitionBIPS must be exactly 10000.
    function defineStrategies(Strategy[] calldata _newStrategies) external onlyDAO {
        require(_newStrategies.length > 0, NoDataFound(bytes("Adapters")));
        uint16 totalRepartitionBIPS = 0;

        for (uint256 i = 0; i < _newStrategies.length; i++) {
            require(_newStrategies[i].adapter.supportsInterface(type(IAdapter).interfaceId),AddressNotAllowed(msg.sender, address(_newStrategies[i].adapter)));
            require(address(_newStrategies[i].adapter) != address(0) && address(_newStrategies[i].adapter) != address(this),AddressNotAllowed(msg.sender, address(_newStrategies[i].adapter)));
            require(_newStrategies[i].repatitionBIPS <= 10000 && _newStrategies[i].repatitionBIPS > 0, BadPercentage(bytes("Repartition"), msg.sender, _newStrategies[i].repatitionBIPS));
            require(_newStrategies[i].deltaBIPS <= 10000 && _newStrategies[i].deltaBIPS > 0, BadPercentage(bytes("Delta"), msg.sender, _newStrategies[i].deltaBIPS));

            totalRepartitionBIPS += _newStrategies[i].repatitionBIPS;
        }
        require(totalRepartitionBIPS == 10000, BadPercentage(bytes("Repartition"), msg.sender, totalRepartitionBIPS));
        
        strategies = _newStrategies;

        emit StrategiesChanged(_newStrategies);
    }

    /// @notice Harvests the profits from the adapters and mints shares to the DAO
    /// @dev The profits are calculated as the difference between the current total assets and the last total assets
    /// @dev The fees are calculated as feesBIPS ‱ of the profits
    /// @dev The shares are calculated as the fees multiplied by 10000 divided by the last total assets
    /// @dev The shares are minted to the DAO address
    /// @dev The last total assets are updated to the current total assets
    /// @dev The rebalance function is called to rebalance the assets in the vault
    /// @custom:todo Check code
    function harvest() external onlyDAO {
        uint256 currentTotalAssets = totalAssets();
        if (currentTotalAssets <= lastTotalAssets) {
            lastTotalAssets = currentTotalAssets;
            return;
        }
        uint256 profit = currentTotalAssets - lastTotalAssets;
        uint256 fees = profit * feesBIPS / 10000; //USDC
        uint256 sharesToMint;

        if (fees > 0) {
            sharesToMint = previewDeposit(fees);
            _mint(daoAddress, sharesToMint);
        }

        lastTotalAssets = currentTotalAssets;

        _rebalance(currentTotalAssets, false);

        emit Harvest(profit, fees, sharesToMint, lastTotalAssets);
    }

    /// @notice Forces the rebalance of the vault
    /// @dev The rebalance function is called to rebalance the assets in the vault
    /// @custom:todo Check code
    function forceRebalance() external onlyDAO {
        _rebalance(totalAssets(), true);
    }

    /// @notice Rebalances the assets in the vault
    /// @param currentTotalAssets The current total assets in the vault
    /// @dev The rebalance function is called to rebalance the assets in the vault
    /// @custom:todo Check code
    function _rebalance(uint256 currentTotalAssets, bool force) internal  {
        uint256 targetBuffer = currentTotalAssets * liquidityBufferBIPS / 10000; 
        uint256 targetInvestedAmount = currentTotalAssets - targetBuffer;
        uint256 currentInvestedAmount;
        uint256 strategyLength = strategies.length;
        uint256[] memory strategyToInvest = new uint256[](strategyLength);
        bool investNeeded;
        uint256 amountToInvestInStrategies;

        for (uint256 index = 0; index < strategyLength; index++) {
            uint256 currentStrategyInvestedAmount = strategies[index].adapter.getInvestedAssets();
            uint256 targetStrategyInvestedAmount = targetInvestedAmount * strategies[index].repatitionBIPS / 10000;
            uint256 deltaStrategy = targetInvestedAmount * strategies[index].deltaBIPS / 10000;

            currentInvestedAmount += currentStrategyInvestedAmount;

            if (currentStrategyInvestedAmount > targetStrategyInvestedAmount + deltaStrategy) {
                // Divest first
                strategies[index].adapter.divest(currentStrategyInvestedAmount - targetStrategyInvestedAmount);

            } else if (currentStrategyInvestedAmount + deltaStrategy < targetStrategyInvestedAmount) {
                investNeeded = true;
                uint256 amountToInvest = targetStrategyInvestedAmount - currentStrategyInvestedAmount;
                amountToInvestInStrategies += amountToInvest;
                strategyToInvest[index] = amountToInvest;
            }
        }

        if (investNeeded) {
            for (uint256 index = 0; index < strategyLength; index++) {
                if (strategyToInvest[index] > 0) {
                    // Invest Second
                    IERC20(asset()).safeTransfer(address(strategies[index].adapter), strategyToInvest[index]);
                    strategies[index].adapter.invest(strategyToInvest[index]);
                }
            }
        }

        emit Rebalance(force, currentTotalAssets, targetBuffer, targetInvestedAmount, currentInvestedAmount, strategyToInvest);
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
    ) public override nonReentrant returns (uint256 glUSDP) {
        require(assetAmount > 0, NotAmountZero());
        require(receiver != address(0), AddressNotAllowed(msg.sender, receiver));

        ERC20(asset()).approve(address(this), assetAmount);
        glUSDP = super.deposit(assetAmount, receiver); // giving shares to the user

        lastTotalAssets += assetAmount;
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
        require(assetAmount <= totalAssets(), BadAmount(bytes("Withdraw"), assetAmount, totalAssets()));

        // if the amount to withdraw is greater than the liquidity buffer, we need to force divest from the strategies and report transaction cost to the user
        if (assetAmount > IERC20(asset()).balanceOf(address(this))) {
            _forceDivest(assetAmount);    
        }   

        assets = super.withdraw(assetAmount, receiver, owner);
        lastTotalAssets -= assets;
        return assets;
    }

    /// @notice Forces the divest of assets from the strategies
    /// @param amount The amount of assets to divest
    /// @dev The forceDivest function is called to divest assets from the strategies
    /// @custom:todo Check code
    function _forceDivest(uint256 amount) internal {
        uint256 totalAmountToDivest = amount - IERC20(asset()).balanceOf(address(this));
        require(totalAmountToDivest > 0, NotAmountZero());
        uint256 remainingToDivest = totalAmountToDivest;

        for (uint256 i = 0; i < strategies.length; i++) {
            if (remainingToDivest == 0) break;

            uint256 amountToDivest;
            uint256 actualBalance = strategies[i].adapter.getInvestedAssets();

            if (i == strategies.length - 1) { // Because of rounding issues, the last strategy must take the remaining amount
                amountToDivest = Math.min(remainingToDivest, actualBalance);
            } else {
                uint256 targetAmount = (totalAmountToDivest * strategies[i].repatitionBIPS) / 10000;
                amountToDivest = Math.min(targetAmount, actualBalance);
            }

            if (amountToDivest > 0) {

                strategies[i].adapter.divest(amountToDivest);

                remainingToDivest -= amountToDivest;

            }
        }
        emit ForceDivest(amount, totalAmountToDivest, remainingToDivest);
    }
}