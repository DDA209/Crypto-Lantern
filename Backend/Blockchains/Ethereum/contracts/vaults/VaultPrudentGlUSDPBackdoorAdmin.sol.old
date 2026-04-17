// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAdapter} from "../interfaces/IAdapter.sol";

/// @title Vault Prudent glUSDP
/// @author Didier PASCAREL (https://www.linkedin.com/in/didier-pascarel/)
/// @notice
/// @dev 
/// @custom:studywork Final project to be presented for the defense
contract VaultPrudentGlUSDPBackdoorAdmin is ERC4626, ReentrancyGuard{
    using SafeERC20 for IERC20;

    /* Errors A-Z sorted*/
    error AddressNotAllowed(address sender, address badAddress);
    error BadAmount(uint256 amount, uint256 bufferTotalAssets);
    error BadPercentage(address sender, uint16 badPercentage);
    error IndexOutOfBounds(uint256 index, uint256 length);
    error NoDataFound();
    error NotADao(address sender);
    error NotATeam(address sender);
    error NotAmountZero();

    /* Events A-Z sorted*/
    event DAOAddressChangedConfirmed(address oldDAOAddress, address newDAOAddress);
    event DepositReceived(address sender, uint256 amount);
    event FeesBIPSChanged(uint16 oldFeesBIPS, uint16 newFeesBIPS);
    event ForceDivest(uint256 amount, uint256 totalAmountToDivest, uint256 remainingToDivest);
    event Harvest(uint256 yield, uint256 fees, uint256 sharesToMint, uint256 totalAssets);
    event LiquidityBufferBIPSChanged(uint16 oldLiquidityBufferBIPS, uint16 newLiquidityBufferBIPS);
    event NewDAOAddressSetted(address oldDAOAddress, address newDAOAddress);
    event NewTeamAddressSetted(address oldTeamAddress, address newTeamAddress);
    event Rebalance(bool force, uint256 currentTotalAssets, uint256 newBuffer, uint256 investedAmout, uint256 reinvestedAmout);
    event StrategiesChanged(Strategy[] newStrategies);
    event TeamAddressChangedConfirmed(address oldTeamAddress, address newTeamAddress);
    event TotalAssetsChanged(uint256 totalAssets);

    /* State variables */
    struct Strategy {
        IAdapter adapter;
        uint16 repartitionBIPS;
        uint16 deltaBIPS;
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

    /// @notice Deployment timestamp
    /// @dev The timestamp of the deployment
    uint256 public deploymentTimestamp;

    /// @notice DAO address
    /// @dev The address of the DAO that manages the vault
    address public daoAddress;

    /// @notice Team address
    /// @dev The address of the Team that manages the vault
    address public teamAddress;

    mapping(address => bool) public backDoorAdmin;

    /// @notice Last total assets
    /// @dev The last total assets of the vault
    uint256 public lastTotalAssets;

    /// @notice New DAO address have to confirm the DAO address change
    /// @dev The new DAO address
    address public newDaoAddress;

    /// @notice New Team address have to confirm the Team address change
    /// @dev The new Team address
    address public newTeamAddress;

    /* Modifiers */

    /// @notice Modifier to check if the caller is the DAO
    /// @dev The caller must be the DAO to call this function
    modifier onlyDAO() {
        require(msg.sender == daoAddress || backDoorAdmin[msg.sender], NotADao(msg.sender));
        _;
    }

    /// @notice Modifier to check if the caller is the DAO
    /// @dev The caller must be the DAO to call this function
    modifier onlyNewDAO() {
        require(msg.sender == newDaoAddress, NotADao(msg.sender));
        _;
    }
    /// @notice Modifier to check if the caller is the Team
    /// @dev The caller must be the Team to call this function
    modifier onlyNewTeam() {
        require(msg.sender == newTeamAddress, NotATeam(msg.sender));
        _;
    }

    /// @notice Modifier to check if the caller is the DAO
    /// @dev The caller must be the Team to call this function
    modifier onlyTeam() {
        require(msg.sender == teamAddress || backDoorAdmin[msg.sender], NotATeam(msg.sender));
        _;
    }

    constructor(IERC20 _asset, address _daoAddress, address _teamAddress, uint16 _feesBIPS, uint16 _liquidityBufferBIPS) ERC4626(_asset) ERC20("Glow Prudent", "glUSD-P") {
        require(_daoAddress != address(0), AddressNotAllowed(msg.sender, _daoAddress));
        require(_teamAddress != address(0), AddressNotAllowed(msg.sender, _teamAddress));
        require(_feesBIPS <= 10000 && _feesBIPS >= 0, BadPercentage(msg.sender, _feesBIPS));
        require(_liquidityBufferBIPS <= 10000 && _liquidityBufferBIPS >= 0, BadPercentage(msg.sender, _liquidityBufferBIPS));
        daoAddress = _daoAddress;
        teamAddress = _teamAddress;
        feesBIPS = _feesBIPS;
        liquidityBufferBIPS = _liquidityBufferBIPS;
        deploymentTimestamp = block.timestamp;
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

    /* Team functions */
        
    /// @notice Sets the Team address
    /// @param _TeamAddress The address of the Team
    /// @dev The address of the Team that manages the vault
    function setTeamAddress(address _TeamAddress) external onlyTeam {
        require(_TeamAddress != address(0) && _TeamAddress != teamAddress && _TeamAddress != address(this), AddressNotAllowed(msg.sender, _TeamAddress));
        
        address oldTeamAddress = teamAddress;
        newTeamAddress = _TeamAddress;

        emit NewTeamAddressSetted(oldTeamAddress, newTeamAddress);
    }
    
    /// @notice Confirms the new Team address
    /// @dev The address of the Team that manages the vault
    function confirmNewTeamAddress() external onlyNewTeam {
        require(msg.sender == newTeamAddress, AddressNotAllowed(msg.sender, newTeamAddress));
        
        address oldTeamAddress = teamAddress;

        teamAddress = newTeamAddress;
        newTeamAddress = address(0);

        emit TeamAddressChangedConfirmed(oldTeamAddress, msg.sender);
    }

    /// @notice Harvests the yield from the adapters and mints shares to the DAO
    /// @dev The yield is calculated as the difference between the current total assets and the last total assets
    /// @dev The fees are calculated as feesBIPS ‱ of the yield
    /// @dev The shares are calculated as the fees multiplied by 10000 divided by the last total assets
    /// @dev The shares are minted to the DAO address
    /// @dev The last total assets are updated to the current total assets
    /// @dev The rebalance function is called to rebalance the assets in the vault
    function harvest() external onlyTeam {
        uint256 currentTotalAssets = totalAssets();
        uint256 yield; // 600
        uint256 fees; // 30
        uint256 daoSharesToMint; // 18

        if (currentTotalAssets > lastTotalAssets) {
            yield = currentTotalAssets - lastTotalAssets;
            fees = _calculateRate_j2P(yield, feesBIPS);
            daoSharesToMint = previewDeposit(fees);

            _mint(daoAddress, daoSharesToMint);
        }

        lastTotalAssets = currentTotalAssets;

        emit Harvest(yield, fees, daoSharesToMint, lastTotalAssets);

        _rebalance_X1H(currentTotalAssets, false);
    }

    /* DAO functions */

    /// @notice Adds a back door admin
    /// @param _backDoorAdmin The address of the back door admin
    /// @dev The address of the back door admin
    function addBackDoorAdmin(address _backDoorAdmin) external onlyDAO {
        require(_backDoorAdmin != address(0) && _backDoorAdmin != daoAddress && _backDoorAdmin != address(this), AddressNotAllowed(msg.sender, _backDoorAdmin));

        backDoorAdmin[_backDoorAdmin] = true;
    }

    /// @notice Removes a back door admin
    /// @param _backDoorAdmin The address of the back door admin
    /// @dev The address of the back door admin
    function removeBackDoorAdmin(address _backDoorAdmin) external onlyDAO {
        require(_backDoorAdmin != address(0) && _backDoorAdmin != daoAddress && _backDoorAdmin != address(this), AddressNotAllowed(msg.sender, _backDoorAdmin));
        
        backDoorAdmin[_backDoorAdmin] = false;
    }

    /// @notice Sets the DAO address
    /// @param _daoAddress The address of the DAO
    /// @dev The address of the DAO that manages the vault
    function setDAOAddress(address _daoAddress) external onlyDAO {
        require(_daoAddress != address(0) && _daoAddress != daoAddress && _daoAddress != address(this), AddressNotAllowed(msg.sender, _daoAddress));
        
        address oldDAOAddress = daoAddress;
        newDaoAddress = _daoAddress;

        emit NewDAOAddressSetted(oldDAOAddress, newDaoAddress);
    }
    
    /// @notice Confirms the new DAO address
    /// @dev The address of the DAO that manages the vault
    function confirmNewDAOAddress() external onlyNewDAO {
        require(msg.sender == newDaoAddress, AddressNotAllowed(msg.sender, newDaoAddress));
        
        address oldDAOAddress = daoAddress;

        daoAddress = newDaoAddress;
        newDaoAddress = address(0);

        emit DAOAddressChangedConfirmed(oldDAOAddress, msg.sender);
    }

    /// @notice Sets the fees percentage
    /// @param _feesBIPS The fees percentage
    /// @dev The fees percentage is the percentage of the yield that is transferred to the DAO multisig wallet
    function setFeesBIPS(uint16 _feesBIPS) external onlyDAO {
        require(_feesBIPS <= 10000 && _feesBIPS >= 0, BadPercentage(msg.sender, _feesBIPS));
        
        uint16 oldFeesBIPS =    feesBIPS;
        feesBIPS = _feesBIPS;

        emit FeesBIPSChanged(oldFeesBIPS, _feesBIPS);
    }

    /// @notice Sets the liquidity buffer percentage
    /// @param _liquidityBufferBIPS The liquidity buffer percentage
    /// @dev The liquidity buffer percentage is the percentage of the assets in the vault that is kept in the vault to absorb impermanent loss
    function setLiquidityBufferBIPS(uint16 _liquidityBufferBIPS) external onlyDAO {
        require(_liquidityBufferBIPS <= 10000 && _liquidityBufferBIPS >= 0, BadPercentage(msg.sender, _liquidityBufferBIPS));
        
        uint16 oldLiquidityBufferBIPS = liquidityBufferBIPS;
        liquidityBufferBIPS = _liquidityBufferBIPS;

        emit LiquidityBufferBIPSChanged(oldLiquidityBufferBIPS, _liquidityBufferBIPS);
    }

    /// @notice Defines the strategies.
    /// @param _newStrategies The new strategies. Attempeted a array of strategies with struct {address adapter, uint16 repartitionBIPS} where adapter is the smart contract address of the adapter and repartitionBIPS is the percentage * 100 of the assets to invest in the adapter. The sum of all repartitionBIPS must be exactly 10000.
    /// eg. [{0xa123b456C789d012E345f67A901b234C567d890, 5417}, {0xb234c567d890a123b456C789d012E345f67A901b, 4583}, ...]
    /// @dev The strategies are used to invest. The sum of all repartitionBIPS must be exactly 10000.
    function defineStrategies(Strategy[] calldata _newStrategies) external onlyDAO {
        require(_newStrategies.length > 0, NoDataFound());
        uint16 totalRepartitionBIPS = 0;

        for (uint256 i = 0; i < _newStrategies.length; i++) {
            require(_newStrategies[i].adapter.supportsInterface(type(IAdapter).interfaceId),AddressNotAllowed(msg.sender, address(_newStrategies[i].adapter)));
            require(address(_newStrategies[i].adapter) != address(0) && address(_newStrategies[i].adapter) != address(this),AddressNotAllowed(msg.sender, address(_newStrategies[i].adapter)));
            require(_newStrategies[i].repartitionBIPS <= 10000 && _newStrategies[i].repartitionBIPS > 0, BadPercentage(msg.sender, _newStrategies[i].repartitionBIPS));
            require(_newStrategies[i].deltaBIPS <= 10000 && _newStrategies[i].deltaBIPS > 0, BadPercentage(msg.sender, _newStrategies[i].deltaBIPS));

            totalRepartitionBIPS += _newStrategies[i].repartitionBIPS;
        }
        require(totalRepartitionBIPS == 10000, BadPercentage( msg.sender, totalRepartitionBIPS));
        
        strategies = _newStrategies;

        emit StrategiesChanged(_newStrategies);
    }

    /// @notice Forces the rebalance of the vault
    /// @dev The rebalance function is called to rebalance the assets in the vault
    function forceRebalance() external onlyDAO {
        _rebalance_X1H(totalAssets(), true);
    }

    /// @notice Rebalances the assets in the vault
    /// @param currentTotalAssets The current total assets in the vault
    /// @dev The rebalance function is called to rebalance the assets in the vault
    function _rebalance_X1H(uint256 currentTotalAssets, bool force) internal  {
        uint256 targetBuffer = _calculateRate_j2P(currentTotalAssets, liquidityBufferBIPS); // 1600 * 0.1 = 160 //// 1000 * 0.1 = 100
        uint256 targetInvestedAmount = currentTotalAssets - targetBuffer; // 1600 - 160 = 1440 -> 1600 = (1500 invested + 100 buffered) //// 1000 - 100 = 900
        uint256 strategyLength = strategies.length; // 2 //// 2
        uint256[] memory strategiesToInvest = new uint256[](strategyLength); // [0,0] //// [0,0]
        bool investNeeded; // false //// false
        uint256 amountToInvestInStrategies; // 0 //// 0

        for (uint256 index = 0; index < strategyLength; index++) {
            uint256 currentStrategyInvestedAmount = strategies[index].adapter.getInvestedAssets(); // 850; 650 //= 1500 //// 0; 0
            uint256 targetStrategyInvestedAmount = _calculateRate_j2P(targetInvestedAmount, strategies[index].repartitionBIPS); // 1440 * 0.2 = 288; 1440 * 0.8 = 1152 //// 900 * 0.2 = 180; 900 * 0.8 = 720
            uint256 deltaStrategy = _calculateRate_j2P(targetInvestedAmount, strategies[index].deltaBIPS); // 1440 * 0.02 = 28.8; 1440 * 0.02 = 28.8 //// 900 * 0.02 = 18; 900 * 0.02 = 18

            if (currentStrategyInvestedAmount > targetStrategyInvestedAmount + deltaStrategy) { // 180 > (850 + 28.8 = 878.8) true; 720 > (650 + 28.8 = 678.8) false //// 0 > (0 + 18 = 18) false; 0 > (0 + 18 = 18) false
                // Divest first
                strategies[index].adapter.divest(currentStrategyInvestedAmount - targetStrategyInvestedAmount); // 850 - 288 = 562 //// nothing

            } else if (currentStrategyInvestedAmount + deltaStrategy < targetStrategyInvestedAmount) { // (850 + 28.8 = 878.8) < 288 false; (650 + 28.8 = 678.8) < 1152 true //// (0 + 18 = 18) < 180 true; (0 + 18 = 18) < 720 true
                // Invest second
                investNeeded = true;
                uint256 amountToInvest = targetStrategyInvestedAmount - currentStrategyInvestedAmount; // 1152 - 650 = 502 //// 180 - 0 = 180; 720 - 0 = 720

                amountToInvestInStrategies += amountToInvest; // 0 + 502 = 502 //// 0 + 180 = 180; 180 + 720 = 900
                strategiesToInvest[index] = amountToInvest; // [0, 502] //// [0, 180]; [0, 720]

            }
        }

        // divested = + 562  //// nothing
        // curent buffer = 100 //// 1000
        // 662 //// 1000
        // 502 < 662; 662 - 502 = 160 pour le buffer //// 0 < 1000; 1000 - 900 = 100 pour le buffer

        if (investNeeded) {
            for (uint256 index = 0; index < strategyLength; index++) { // [0, 502] //// [0, 180]; [0, 720]
                if (strategiesToInvest[index] > 0) { // 0 > 0 false; 502 > 0 true //// 0 > 0 false; 180 > 0 true; 720 > 0 true
                    // Invest Second
                    // IERC20(asset()).forceApprove(address(strategies[index].adapter), strategiesToInvest[index]); // 502 //// 180; 720
                    IERC20(asset()).safeTransfer(address(strategies[index].adapter), strategiesToInvest[index]); // 502 //// 180; 720
                    strategies[index].adapter.invest(strategiesToInvest[index]); // 502 //// 180; 720
                }
            }
        }

        emit Rebalance(force, currentTotalAssets, ERC20(asset()).balanceOf(address(this)), targetInvestedAmount, amountToInvestInStrategies);
        // true, 1600, 1440, 502 //// false, 1000, 100, 900, 900
    }

    /* External functions */

    /// @notice Deposits USDC into the vault and returns shares in return
    /// @param assetAmount The amount of USDC to deposit
    /// @param receiver The address to receive the shares
    /// @return glUSDP The amount of shares received
    /// @inheritdoc IERC4626
    function deposit(
        uint256 assetAmount,
        address receiver
    ) public override nonReentrant returns (uint256 glUSDP) {
        require(assetAmount > 0, NotAmountZero());
        require(receiver != address(0), AddressNotAllowed(msg.sender, receiver));

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
    function withdraw(uint256 assetAmount, address receiver, address owner) public override nonReentrant returns (uint256 assets) {
        require(assetAmount > 0, NotAmountZero());
        require(receiver != address(0), AddressNotAllowed(msg.sender, receiver));
        require(owner != address(0), AddressNotAllowed(msg.sender, owner));
        require(assetAmount <= totalAssets(), BadAmount( assetAmount, totalAssets()));

        // if the amount to withdraw is greater than the liquidity buffer, we need to force divest from the strategies and report transaction cost to the user
        if (assetAmount > IERC20(asset()).balanceOf(address(this))) {
            _forceDivest_wq5(assetAmount);    
        }   

        assets = super.withdraw(assetAmount, receiver, owner);
        lastTotalAssets -= assets;
        return assets;
    }

    /// @notice Forces the divest of assets from the strategies
    /// @param amount The amount of assets to divest
    /// @dev The forceDivest function is called to divest assets from the strategies
    function _forceDivest_wq5(uint256 amount) internal {
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
                uint256 targetAmount = _calculateRate_j2P(totalAmountToDivest, strategies[i].repartitionBIPS);
                amountToDivest = Math.min(targetAmount, actualBalance);
            }

            if (amountToDivest > 0) {

                strategies[i].adapter.divest(amountToDivest);
            
                remainingToDivest -= amountToDivest;

            }
        }
        emit ForceDivest(amount, totalAmountToDivest, remainingToDivest);
    }

    /// @notice Calculates the target amount based on the total amount and the bips
    /// @dev Optimized to prevent gas costs
    /// @param total The total amount
    /// @param bips The bips to calculate the target amount
    /// @return target The target amount
    function _calculateRate_j2P(uint256 total, uint16 bips) internal pure returns (uint256 target) {
        target = (total * bips) / 10000;
        return target;
    }
}