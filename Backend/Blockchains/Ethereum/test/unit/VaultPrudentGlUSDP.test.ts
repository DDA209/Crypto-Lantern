import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/types';
import { expect } from 'chai';
import { network } from 'hardhat';
import {
	AaveAdapterUSDC,
	MockUSDC,
	MockAaveToken,
	VaultPrudentGlUSDP,
} from '../../types/ethers-contracts/index.js';
import { Addressable, ContractTransactionResponse } from 'ethers';

const { ethers, networkHelpers } = await network.connect('hardhatMainnetFork');

const currentBlock = await ethers.provider.getBlockNumber();
console.info(
	`⚠️\nLe Bloc actuel du réseau de test est ${currentBlock}\nRéseau ${
		(await ethers.provider.getNetwork()).name
	}`,
);

interface Accounts {
	owner: HardhatEthersSigner;
	dao: HardhatEthersSigner;
	newDao: HardhatEthersSigner;
	poorUser: HardhatEthersSigner;
	whale: HardhatEthersSigner;
}

const prodAddresses = {
	usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
	aUSDC: '0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c',
	aaveLendingPool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
	//whale: '0x28C6c06298d514Db089934071355E5743bf21d60', // Binance
	whale: '0x38AAEF3782910bdd9eA3566C839788Af6FF9B200', //2_664_559_519.701 USDC
};

/* Fixtures */
const getAccounts = async (isProd: boolean): Promise<Accounts> => {
	let [owner, dao, newDao, poorUser, whale] = await ethers.getSigners();

	if (isProd) {
		await ethers.getImpersonatedSigner(prodAddresses.whale);
		whale = await ethers.getSigner(prodAddresses.whale);
		await networkHelpers.setBalance(
			whale.address,
			ethers.parseEther('1.1'),
		);
	}

	return { owner, dao, newDao, poorUser, whale };
};

const deployUSDCContract = async (isProd: boolean): Promise<MockUSDC> => {
	if (isProd) {
		const usdcContract = await ethers.getContractAt(
			'MockUSDC',
			prodAddresses.usdc,
		);
		return usdcContract;
	}
	const mockUsdc = await ethers.deployContract('MockUSDC');
	return mockUsdc;
};

const deployAUSDCContract = async (isProd: boolean): Promise<MockAaveToken> => {
	if (isProd) {
		const aUSDCContract = await ethers.getContractAt(
			'MockAaveToken',
			prodAddresses.aUSDC,
		);
		return aUSDCContract;
	}
	const mockAaveToken = await ethers.deployContract('MockAaveToken');
	return mockAaveToken;
};

const deployVaultPrudentGlUSDPContract = async (
	usdcContract: string | Addressable,
	dao: HardhatEthersSigner,
): Promise<VaultPrudentGlUSDP> => {
	const vault = await ethers.deployContract('VaultPrudentGlUSDP', [
		usdcContract,
		dao.address,
	]);
	return vault;
};

const deployAdapters = async (
	vaultAddress: string | Addressable,
): Promise<AaveAdapterUSDC> => {
	const aaveAdapterUSDC = await ethers.deployContract('AaveAdapterUSDC', [
		prodAddresses.usdc,
		prodAddresses.aUSDC,
		prodAddresses.aaveLendingPool,
		vaultAddress,
	]);
	return aaveAdapterUSDC;
};

const deployFixture = async (): Promise<{
	usdcContract: MockUSDC;
	accounts: Accounts;
	vaultPrudentGlUSDPContract: VaultPrudentGlUSDP;
	aaveAdapterUSDCContract?: AaveAdapterUSDC;
}> => {
	const withAdapters = currentBlock > 0;
	// 1. Accounts
	const accounts = await getAccounts(withAdapters);
	// 2. USDC & aUSDC contract deployment
	const usdcContract = await deployUSDCContract(withAdapters);
	const usdcContractAddress = usdcContract.target;
	const aUSDCContract = await deployAUSDCContract(withAdapters);
	const aUSDCContractAddress = aUSDCContract.target;
	// 3. Vault and Adapter deployment
	const vaultPrudentGlUSDPContract = await deployVaultPrudentGlUSDPContract(
		usdcContractAddress,
		accounts.dao,
	);
	// 4. Mint some USDC to the whale
	if (!withAdapters) {
		const mintAmount = ethers.parseUnits('100000', 6); // 100_000 USDC
		await (usdcContract as MockUSDC).mint(
			accounts.whale.address,
			mintAmount,
		);
		const approveTx = await (usdcContract as MockUSDC)
			.connect(accounts.whale)
			.approve(vaultPrudentGlUSDPContract.target, mintAmount);
		await approveTx.wait();
	}
	// 5. Deploy adapters
	if (withAdapters) {
		// 5.1. Deploy adapters
		const aaveAdapterUSDCContract = await deployAdapters(
			vaultPrudentGlUSDPContract,
		);
		// 5.2. Define strategies
		await daoDefineStrategies(
			accounts,
			vaultPrudentGlUSDPContract,
			aaveAdapterUSDCContract,
		);
		console.log('startegy', await vaultPrudentGlUSDPContract.strategies(0));
		return {
			usdcContract,
			accounts,
			vaultPrudentGlUSDPContract,
			aaveAdapterUSDCContract,
		};
	}

	return { usdcContract, accounts, vaultPrudentGlUSDPContract };
};

/* Utils */
const daoDefineStrategies = async (
	accounts: Accounts,
	vaultPrudentGlUSDPContract: VaultPrudentGlUSDP,
	aaveAdapterUSDCContract: AaveAdapterUSDC,
): Promise<void> => {
	const { dao } = accounts;
	const currentDao = await vaultPrudentGlUSDPContract.dao();
	if (currentDao !== dao.address) {
		await vaultPrudentGlUSDPContract
			.connect(dao)
			.setDAOAddress(dao.address);
	}

	const strategies = [
		{
			adapter: aaveAdapterUSDCContract.target,
			repatitionBIPS: 10000,
		},
	];
	const defineStrategiesTx = vaultPrudentGlUSDPContract
		.connect(dao)
		.defineStrategies(strategies);
	await defineStrategiesTx;
};

/* Helpers */

const userDepositUsdc = async (
	user: HardhatEthersSigner,
	vaultPrudentGlUSDPContract: VaultPrudentGlUSDP,
	asset: MockUSDC,
	depositAmount: bigint,
): Promise<{
	vaultBalanceBefore: bigint;
	userBalanceBefore: bigint;
	userSharesBefore: bigint;
	approveTx: Promise<ContractTransactionResponse>;
}> => {
	const vaultBalanceBefore = await asset.balanceOf(
		vaultPrudentGlUSDPContract.target,
	); // Enregistrement des soldes avant transaction
	const userBalanceBefore = await asset.balanceOf(user.address);
	const userSharesBefore = await vaultPrudentGlUSDPContract.balanceOf(
		user.address,
	);

	// Approve USDC to the vault
	const approveTx = asset
		.connect(user)
		.approve(vaultPrudentGlUSDPContract.target, depositAmount);

	// Deposit USDC into the vault

	return {
		vaultBalanceBefore,
		userBalanceBefore,
		userSharesBefore,
		approveTx,
	};
};

const userRedeemUsdc = async (
	user: HardhatEthersSigner,
	vaultPrudentGlUSDPContract: VaultPrudentGlUSDP,
	asset: MockUSDC,
	usdcToRedeem: bigint,
): Promise<{
	assets: bigint;
	vaultBalanceBefore: bigint;
	userBalanceBefore: bigint;
	userSharesBefore: bigint;
	withdrawTx: Promise<ContractTransactionResponse>;
}> => {
	const vaultBalanceBefore = await asset.balanceOf(
		vaultPrudentGlUSDPContract.target,
	); // Enregistrement des soldes avant transaction
	const userBalanceBefore = await asset.balanceOf(user.address);
	const userSharesBefore = await vaultPrudentGlUSDPContract.balanceOf(
		user.address,
	);
	// Get assets amount
	const assets = await vaultPrudentGlUSDPContract.previewWithdraw(
		usdcToRedeem,
	);

	// Withdraw USDC from the vault
	const withdrawTx = vaultPrudentGlUSDPContract
		.connect(user)
		.withdraw(usdcToRedeem, user.address, user.address);

	return {
		assets,
		vaultBalanceBefore,
		userBalanceBefore,
		userSharesBefore,
		withdrawTx,
	};
};

/* tests */
describe('Deployment', () => {
	let accounts: Accounts;
	let usdcContract: MockUSDC;

	beforeEach(async () => {
		({ accounts, usdcContract } = await networkHelpers.loadFixture(
			deployFixture,
		));
	});

	it('Should the whate has at least 100_000 USDC.', async () => {
		/* Arrange & Act */
		const whaleBalance = await usdcContract.balanceOf(
			accounts.whale.address,
		);
		console.log('Whale balance', whaleBalance.toString(), ' USDC');

		/* Assert */
		expect(whaleBalance).to.be.gte(100_000); // greaterThanOrEqual
	});

	it('Should the whale has anougth ETH to pay for gas fees.', async () => {
		/* Arrange & Act */
		const whaleBalance = await ethers.provider.getBalance(
			accounts.whale.address,
		);
		console.log('Whale ETH balance', whaleBalance.toString(), ' ETH');
		/* Assert */
		expect(whaleBalance).to.be.gte(1); // greaterThanOrEqual
	});
});

describe('DAO functions', () => {
	let vaultPrudentGlUSDPContract: VaultPrudentGlUSDP;
	let accounts: Accounts;
	const newLiquidityBufferBIPS: bigint = 1300n;
	const newFeesBIPS: bigint = 1000n;

	beforeEach(async () => {
		({ accounts, vaultPrudentGlUSDPContract } =
			await networkHelpers.loadFixture(deployFixture));
	});
	describe('Set a new DAO address', () => {
		it('Should allow the DAO to change the DAO address.', async () => {
			/* Arrange */
			const newDao = accounts.newDao;
			let dao: HardhatEthersSigner = accounts.dao;

			/* Act */
			const setDAOAddressTx = vaultPrudentGlUSDPContract
				.connect(dao)
				.setDAOAddress(newDao);
			await setDAOAddressTx;

			/* Assert */
			expect(await vaultPrudentGlUSDPContract.dao()).to.equal(newDao);
			await expect(setDAOAddressTx)
				.to.emit(vaultPrudentGlUSDPContract, 'DaoChanged')
				.withArgs(dao.address, newDao.address);
		});

		it("Shouldn't allow a non-DAO user to change the DAO address.", async () => {
			/* Arrange */
			const poorUser: HardhatEthersSigner = accounts.poorUser;

			/* Act */
			const setDAOAddressTx = vaultPrudentGlUSDPContract
				.connect(poorUser)
				.setDAOAddress(poorUser.address);

			/* Assert */
			await expect(setDAOAddressTx)
				.to.be.revertedWithCustomError(
					vaultPrudentGlUSDPContract,
					'NotDao',
				)
				.withArgs(poorUser.address);
		});

		it("Shouldn't allow owner to change the DAO address.", async () => {
			/* Arrange */
			const owner: HardhatEthersSigner = accounts.owner;

			/* Act */
			const setDAOAddressTx = vaultPrudentGlUSDPContract.setDAOAddress(
				owner.address,
			);

			/* Assert */
			await expect(setDAOAddressTx)
				.to.be.revertedWithCustomError(
					vaultPrudentGlUSDPContract,
					'NotDao',
				)
				.withArgs(owner.address);
		});
	});
	describe('Set liquidity buffer percentage', () => {
		it('Should allow the DAO to change the liquidity buffer percentage.', async () => {
			/* Arrange */
			const dao: HardhatEthersSigner = accounts.dao;
			const oldLiquidityBufferBIPS = await vaultPrudentGlUSDPContract
				.connect(dao)
				.liquidityBufferBIPS();

			/* Act */
			const setLiquidityBufferBIPSTx = vaultPrudentGlUSDPContract
				.connect(dao)
				.setLiquidityBufferBIPS(newLiquidityBufferBIPS);

			/* Assert */
			await expect(setLiquidityBufferBIPSTx)
				.to.emit(
					vaultPrudentGlUSDPContract,
					'LiquidityBufferBIPSChanged',
				)
				.withArgs(oldLiquidityBufferBIPS, newLiquidityBufferBIPS);

			/* Act */
			const liquidityBufferBIPS = await vaultPrudentGlUSDPContract
				.connect(dao)
				.liquidityBufferBIPS();

			/* Assert */
			expect(liquidityBufferBIPS).to.equal(newLiquidityBufferBIPS);
		});

		it("Shouldn't allow a non-DAO user to change the liquidity buffer percentage.", async () => {
			/* Arrange */
			const poorUser: HardhatEthersSigner = accounts.poorUser;

			/* Act */
			const liquidityBufferBIPSTx = vaultPrudentGlUSDPContract
				.connect(poorUser)
				.setLiquidityBufferBIPS(newLiquidityBufferBIPS);

			/* Assert */
			await expect(liquidityBufferBIPSTx)
				.to.be.revertedWithCustomError(
					vaultPrudentGlUSDPContract,
					'NotDao',
				)
				.withArgs(poorUser.address);
		});

		it("Shouldn't allow owner to change the liquidity buffer percentage.", async () => {
			/* Arrange */
			const owner: HardhatEthersSigner = accounts.owner;

			/* Act */
			const liquidityBufferBIPSTx =
				vaultPrudentGlUSDPContract.setLiquidityBufferBIPS(
					newLiquidityBufferBIPS,
				);

			/* Assert */
			await expect(liquidityBufferBIPSTx)
				.to.be.revertedWithCustomError(
					vaultPrudentGlUSDPContract,
					'NotDao',
				)
				.withArgs(owner.address);
		});
	});
	describe('Set fees percentage', () => {
		it('Should allow the DAO to change the fees percentage.', async () => {
			/* Arrange */
			const dao: HardhatEthersSigner = accounts.dao;
			const oldFeesBIPS = await vaultPrudentGlUSDPContract
				.connect(dao)
				.feesBIPS();

			/* Act */
			const feesBIPSTx = vaultPrudentGlUSDPContract
				.connect(dao)
				.setFeesBIPS(newFeesBIPS);

			/* Assert */
			await expect(feesBIPSTx)
				.to.emit(vaultPrudentGlUSDPContract, 'FeesBIPSChanged')
				.withArgs(oldFeesBIPS, newFeesBIPS);

			/* Act */
			const feesBIPS = await vaultPrudentGlUSDPContract
				.connect(dao)
				.feesBIPS();

			/* Assert */
			expect(feesBIPS).to.equal(newFeesBIPS);
		});

		it("Shouldn't allow a non-DAO user to change the fees percentage.", async () => {
			/* Arrange */
			const poorUser: HardhatEthersSigner = accounts.poorUser;

			/* Act */
			const feesBIPSTx = vaultPrudentGlUSDPContract
				.connect(poorUser)
				.setFeesBIPS(newFeesBIPS);

			/* Assert */
			await expect(feesBIPSTx)
				.to.be.revertedWithCustomError(
					vaultPrudentGlUSDPContract,
					'NotDao',
				)
				.withArgs(poorUser.address);
		});

		it("Shouldn't allow owner to change the fees percentage.", async () => {
			/* Arrange */
			const owner: HardhatEthersSigner = accounts.owner;

			/* Act */
			const feesBIPSTx = vaultPrudentGlUSDPContract
				.connect(owner)
				.setFeesBIPS(newFeesBIPS);

			/* Assert */
			await expect(feesBIPSTx)
				.to.be.revertedWithCustomError(
					vaultPrudentGlUSDPContract,
					'NotDao',
				)
				.withArgs(owner.address);
		});
	});
});

describe('Getters functions', () => {
	let vaultPrudentGlUSDPContract: VaultPrudentGlUSDP;
	let accounts: Accounts;
	const expectedFeesBIPS = 500n;
	const expectedLiquidityBufferBIPS = 1000n;

	beforeEach(async () => {
		({ vaultPrudentGlUSDPContract, accounts } =
			await networkHelpers.loadFixture(deployFixture));
	});

	it('Should return fees percentage to any user.', async () => {
		/* Arrange */

		/* Act */
		const feesBIPS = await vaultPrudentGlUSDPContract
			.connect(accounts.poorUser)
			.feesBIPS();

		/* Assert */
		expect(feesBIPS).to.equal(expectedFeesBIPS);
	});

	it('Should return liquidity buffer percentage to any user.', async () => {
		/* Arrange */

		/* Act */
		const liquidityBufferBIPS = await vaultPrudentGlUSDPContract
			.connect(accounts.poorUser)
			.liquidityBufferBIPS();

		/* Assert */
		expect(liquidityBufferBIPS).to.equal(expectedLiquidityBufferBIPS);
	});

	it('Should return DAO address to any user.', async () => {
		/* Arrange */
		const expectedDao = accounts.dao;

		/* Act */
		const dao = await vaultPrudentGlUSDPContract
			.connect(accounts.poorUser)
			.dao();

		/* Assert */
		expect(dao).to.equal(expectedDao);
	});
});

describe('Vault - Business Logic', () => {
	const IS_PROD = currentBlock > 0;
	let accounts: Accounts;
	let usdcContract: MockUSDC;
	let vaultPrudentGlUSDPContract: VaultPrudentGlUSDP;
	let usdcDepositAmount = ethers.parseUnits('5000', 6);
	let aaveAdapterUSDCContract: AaveAdapterUSDC | undefined;

	beforeEach(async () => {
		({
			usdcContract,
			vaultPrudentGlUSDPContract,
			accounts,
			aaveAdapterUSDCContract,
		} = await networkHelpers.loadFixture(deployFixture));
	});
	describe('Deposits', () => {
		it('Should allow the whale user to deposit USDC, receive shares, and emit event.', async () => {
			/* Arrange & Act */
			const {
				approveTx,
				vaultBalanceBefore,
				userBalanceBefore: whaleBalanceBefore,
				userSharesBefore: whaleGlUSDPBefore,
			} = await userDepositUsdc(
				accounts.whale,
				vaultPrudentGlUSDPContract,
				usdcContract,
				usdcDepositAmount,
			);

			await approveTx;

			const depositTx = vaultPrudentGlUSDPContract
				.connect(accounts.whale)
				.deposit(usdcDepositAmount, accounts.whale.address);

			/* Assert */
			// event Deposit
			await expect(depositTx)
				.to.emit(vaultPrudentGlUSDPContract, 'Deposit') // IERC4626 event Deposit
				.withArgs(
					accounts.whale.address,
					accounts.whale.address,
					usdcDepositAmount,
					usdcDepositAmount,
				);

			// Balances
			const [
				vaultBalanceAfter,
				whaleBalanceAfter,
				vaultTotalAssets,
				whaleGlUSDPAfter,
			] = await Promise.all([
				usdcContract.balanceOf(vaultPrudentGlUSDPContract.target),
				usdcContract.balanceOf(accounts.whale.address),
				vaultPrudentGlUSDPContract.totalAssets(),
				vaultPrudentGlUSDPContract.balanceOf(accounts.whale.address),
			]);

			// expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(
			// 	usdcDepositAmount,
			// );
			expect(whaleBalanceBefore - whaleBalanceAfter).to.equal(
				usdcDepositAmount,
			);
			expect(whaleGlUSDPAfter - whaleGlUSDPBefore).to.equal(
				usdcDepositAmount,
			);
			// expect(vaultTotalAssets - vaultBalanceBefore).to.equal(
			// 	usdcDepositAmount,
			// );
		});
	});
	it("Shouldn't allow a poor user to deposit USDC.", async () => {
		/* Arrange & Act */
		const { approveTx } = await userDepositUsdc(
			accounts.poorUser,
			vaultPrudentGlUSDPContract,
			usdcContract,
			usdcDepositAmount,
		);
		await approveTx;
		const depositTx = vaultPrudentGlUSDPContract
			.connect(accounts.poorUser)
			.deposit(usdcDepositAmount, accounts.poorUser.address);
		/* Assert */
		await expect(depositTx).to.be.revertedWith(
			'ERC20: transfer amount exceeds balance',
		);
	});
	describe('Redeems', () => {
		const USDC_TO_REDEEM = 100n;

		it('Should allow the whale user to redeem USDC, burn glUSD-P, and emit event.', async () => {
			/* Arrange & Act */
			console.table({
				'USDC to invest': usdcDepositAmount + ' USDC',
				'USDC to redeem': USDC_TO_REDEEM + ' USDC',
			});
			const amoutAWB = await usdcContract.balanceOf(
				accounts.whale.address,
			);
			const amoutSWB = await vaultPrudentGlUSDPContract.balanceOf(
				accounts.whale.address,
			);
			const amoutAVB = await usdcContract.balanceOf(
				vaultPrudentGlUSDPContract.target,
			);
			const amoutAAVB = await vaultPrudentGlUSDPContract.totalAssets();

			const amounAIB =
				currentBlock > 0
					? await aaveAdapterUSDCContract!.getInvestedAssets()
					: 0n;
			console.log('USDC contract address', usdcContract.target);
			console.log(
				'Vault contract address',
				vaultPrudentGlUSDPContract.target,
			);

			console.table({
				'Whale assets Before': amoutAWB + ' USDC',
				'Whale shares Before': amoutSWB + ' glUSD-P',
				'Vault assets Before': amoutAVB + ' USDC',
				'Vault a-assets Before': amoutAAVB + ' aUSDC + USDC',
				'Invested assets Before': amounAIB + ' aUSDC',
			});
			const { approveTx } = await userDepositUsdc(
				accounts.whale,
				vaultPrudentGlUSDPContract,
				usdcContract,
				usdcDepositAmount,
			);
			await approveTx;
			const depositTx = vaultPrudentGlUSDPContract
				.connect(accounts.whale)
				.deposit(usdcDepositAmount, accounts.whale.address);

			await depositTx;

			const {
				assets: usdcRedeemed,
				vaultBalanceBefore,
				userBalanceBefore: whaleBalanceBefore,
				userSharesBefore: whaleGlUSDPBefore,
				withdrawTx,
			} = await userRedeemUsdc(
				accounts.whale,
				vaultPrudentGlUSDPContract,
				usdcContract,
				USDC_TO_REDEEM,
			);

			const amoutAWA = await usdcContract.balanceOf(
				accounts.whale.address,
			);
			const amoutSWA = await vaultPrudentGlUSDPContract.balanceOf(
				accounts.whale.address,
			);
			const amoutAVA = await usdcContract.balanceOf(
				vaultPrudentGlUSDPContract.target,
			);
			const amoutAVA2 = await vaultPrudentGlUSDPContract.totalAssets();
			const amounAIA =
				currentBlock > 0
					? await aaveAdapterUSDCContract!.getInvestedAssets()
					: 0n;
			console.table({
				'Whale assets After': amoutAWA + ' USDC',
				'Whale shares After': amoutSWA + ' glUSD-P',
				'Vault assets After': amoutAVA + ' USDC',
				'Vault a-assets After': amoutAVA2 + ' aUSDC + USDC',
				'Invested assets After': amounAIA + ' aUSDC',
			});
			/* Assert */
			// event Redeem
			await expect(withdrawTx)
				.to.emit(vaultPrudentGlUSDPContract, 'Withdraw') // IERC4626 event Withdraw
				.withArgs(
					accounts.whale.address,
					accounts.whale.address,
					accounts.whale.address,
					usdcRedeemed, // 1 wei is lost in the void
					USDC_TO_REDEEM,
				);

			// Balances
			const [
				vaultBalanceAfter,
				whaleBalanceAfter,
				vaultTotalAssets,
				whaleGlUSDPAfter,
			] = await Promise.all([
				usdcContract.balanceOf(vaultPrudentGlUSDPContract.target),
				usdcContract.balanceOf(accounts.whale.address),
				vaultPrudentGlUSDPContract.totalAssets(),
				vaultPrudentGlUSDPContract.balanceOf(accounts.whale.address),
			]);

			expect(vaultBalanceBefore - vaultBalanceAfter).to.equal(
				usdcRedeemed,
			);
			expect(whaleBalanceAfter - whaleBalanceBefore).to.equal(
				usdcRedeemed,
			);
			expect(whaleGlUSDPBefore - whaleGlUSDPAfter).to.equal(
				USDC_TO_REDEEM,
			);
			// expect(vaultBalanceBefore - vaultTotalAssets).to.equal(
			// 	usdcRedeemed,
			// );
		});
	});
});

//npx hardhat test test/unit/VaultPrudentGlUSDP.test.ts --coverage
