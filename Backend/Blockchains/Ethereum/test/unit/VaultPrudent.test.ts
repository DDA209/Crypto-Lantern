import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/types';
import { expect } from 'chai';
import { network } from 'hardhat';
import { MockUSDC, VaultPrudent } from '../../types/ethers-contracts/index.js';
import { ContractTransactionResponse } from 'ethers';

const { ethers, networkHelpers } = await network.connect();

interface Accounts {
	owner: HardhatEthersSigner;
	dao: HardhatEthersSigner;
	newDao: HardhatEthersSigner;
	poorUser: HardhatEthersSigner;
	whale: HardhatEthersSigner;
}

/* Fixtures */
const getAccounts = async (): Promise<Accounts> => {
	const [owner, dao, newDao, poorUser, whale] = await ethers.getSigners();
	return { owner, dao, newDao, poorUser, whale } as Accounts;
};

const deployMockUsdc = async (): Promise<MockUSDC> => {
	const mockUsdc = await ethers.deployContract('MockUSDC');
	return mockUsdc;
};

const deployVaultPrudent = async (
	mockUsdc: MockUSDC,
	dao: HardhatEthersSigner,
): Promise<VaultPrudent> => {
	const vault = await ethers.deployContract('VaultPrudent', [
		mockUsdc.target,
		dao.address,
	]);
	return vault;
};

const deployFixture = async (): Promise<{
	usdcContract: MockUSDC;
	accounts: Accounts;
	vaultPrudentContract: VaultPrudent;
}> => {
	// 1. Accounts
	const accounts = await getAccounts();
	// 2. USDC Mock contract deployment
	const mockUsdcContract = await deployMockUsdc();
	// 3. Vault deployment
	const vaultPrudentContract = await deployVaultPrudent(
		mockUsdcContract,
		accounts.dao,
	);
	// 4. Mint some USDC to the whale
	const mintAmount = ethers.parseUnits('100000', 6);
	await mockUsdcContract.mint(accounts.whale.address, mintAmount);
	const approveTx = await mockUsdcContract
		.connect(accounts.whale)
		.approve(vaultPrudentContract.target, mintAmount);
	await approveTx.wait();

	return {
		usdcContract: mockUsdcContract,
		accounts,
		vaultPrudentContract,
	};
};

/* Utils */
const userDepositUsdc = async (
	user: HardhatEthersSigner,
	vaultPrudentContract: VaultPrudent,
	asset: MockUSDC,
	depositAmount: bigint,
): Promise<{
	shares: bigint;
	vaultBalanceBefore: bigint;
	userBalanceBefore: bigint;
	userSharesBefore: bigint;
	depositTx: Promise<ContractTransactionResponse>;
}> => {
	const vaultBalanceBefore = await asset.balanceOf(
		vaultPrudentContract.target,
	); // Enregistrement des soldes avant transaction
	const userBalanceBefore = await asset.balanceOf(user.address);
	const userSharesBefore = await vaultPrudentContract.balanceOf(user.address);

	// Get shares amount
	const shares = await vaultPrudentContract.previewMint(depositAmount);

	// Deposit USDC into the vault
	const depositTx = vaultPrudentContract
		.connect(user)
		.deposit(depositAmount, user.address);

	return {
		shares,
		vaultBalanceBefore,
		userBalanceBefore,
		userSharesBefore,
		depositTx,
	};
};

const userRedeemUsdc = async (
	user: HardhatEthersSigner,
	vaultPrudentContract: VaultPrudent,
	asset: MockUSDC,
	glUsdPToBurn: bigint,
): Promise<{
	assets: bigint;
	vaultBalanceBefore: bigint;
	userBalanceBefore: bigint;
	userSharesBefore: bigint;
	redeemTx: Promise<ContractTransactionResponse>;
}> => {
	const vaultBalanceBefore = await asset.balanceOf(
		vaultPrudentContract.target,
	); // Enregistrement des soldes avant transaction
	const userBalanceBefore = await asset.balanceOf(user.address);
	const userSharesBefore = await vaultPrudentContract.balanceOf(user.address);
	// Get assets amount
	const assets = await vaultPrudentContract.previewRedeem(glUsdPToBurn);

	// Redeem USDC from the vault
	const redeemTx = vaultPrudentContract
		.connect(user)
		.redeem(glUsdPToBurn, user.address, user.address);

	return {
		assets,
		vaultBalanceBefore,
		userBalanceBefore,
		userSharesBefore,
		redeemTx,
	};
};
/* tests */
describe('Initialisation', () => {
	it('Should confirm that the test environment is running locally', async () => {
		/* Arrange */
		const expectedBlock = 0n;

		/* Act */
		const currentBlock = await ethers.provider.getBlockNumber();

		/* Assert */
		console.log(`Current block : ${currentBlock}`);
		expect(currentBlock).to.equal(expectedBlock);
	});
});

describe('DAO functions', () => {
	let vaultPrudentContract: VaultPrudent;
	let accounts: Accounts;
	const newLiquidityBufferBIPS: bigint = 1300n;
	const newFeesBIPS: bigint = 1000n;

	beforeEach(async () => {
		({ accounts, vaultPrudentContract } = await networkHelpers.loadFixture(
			deployFixture,
		));
	});
	describe('Set a new DAO address', () => {
		it('Should allow the DAO to change the DAO address.', async () => {
			/* Arrange */
			const newDao = accounts.newDao;
			let dao: HardhatEthersSigner = accounts.dao;

			/* Act */
			const setDaoTx = vaultPrudentContract.connect(dao).setDao(newDao);
			await setDaoTx;

			/* Assert */
			expect(await vaultPrudentContract.dao()).to.equal(newDao);
			await expect(setDaoTx)
				.to.emit(vaultPrudentContract, 'DaoChanged')
				.withArgs(dao.address, newDao.address);
		});

		it("Shouldn't allow a non-DAO user to change the DAO address.", async () => {
			/* Arrange */
			const poorUser: HardhatEthersSigner = accounts.poorUser;

			/* Act */
			const setDaoTx = vaultPrudentContract
				.connect(poorUser)
				.setDao(poorUser.address);

			/* Assert */
			await expect(setDaoTx)
				.to.be.revertedWithCustomError(vaultPrudentContract, 'NotDao')
				.withArgs(poorUser.address);
		});

		it("Shouldn't allow owner to change the DAO address.", async () => {
			/* Arrange */
			const owner: HardhatEthersSigner = accounts.owner;

			/* Act */
			const setDaoTx = vaultPrudentContract.setDao(owner.address);

			/* Assert */
			await expect(setDaoTx)
				.to.be.revertedWithCustomError(vaultPrudentContract, 'NotDao')
				.withArgs(owner.address);
		});
	});
	describe('Set liquidity buffer percentage', () => {
		it('Should allow the DAO to change the liquidity buffer percentage.', async () => {
			/* Arrange */
			const dao: HardhatEthersSigner = accounts.dao;
			const oldLiquidityBufferBIPS = await vaultPrudentContract
				.connect(dao)
				.liquidityBufferBIPS();

			/* Act */
			const setLiquidityBufferBIPSTx = vaultPrudentContract
				.connect(dao)
				.setLiquidityBufferBIPS(newLiquidityBufferBIPS);

			/* Assert */
			await expect(setLiquidityBufferBIPSTx)
				.to.emit(vaultPrudentContract, 'LiquidityBufferBIPSChanged')
				.withArgs(oldLiquidityBufferBIPS, newLiquidityBufferBIPS);

			/* Act */
			const liquidityBufferBIPS = await vaultPrudentContract
				.connect(dao)
				.liquidityBufferBIPS();

			/* Assert */
			expect(liquidityBufferBIPS).to.equal(newLiquidityBufferBIPS);
		});

		it("Shouldn't allow a non-DAO user to change the liquidity buffer percentage.", async () => {
			/* Arrange */
			const poorUser: HardhatEthersSigner = accounts.poorUser;

			/* Act */
			const liquidityBufferBIPSTx = vaultPrudentContract
				.connect(poorUser)
				.setLiquidityBufferBIPS(newLiquidityBufferBIPS);

			/* Assert */
			await expect(liquidityBufferBIPSTx)
				.to.be.revertedWithCustomError(vaultPrudentContract, 'NotDao')
				.withArgs(poorUser.address);
		});

		it("Shouldn't allow owner to change the liquidity buffer percentage.", async () => {
			/* Arrange */
			const owner: HardhatEthersSigner = accounts.owner;

			/* Act */
			const liquidityBufferBIPSTx =
				vaultPrudentContract.setLiquidityBufferBIPS(
					newLiquidityBufferBIPS,
				);

			/* Assert */
			await expect(liquidityBufferBIPSTx)
				.to.be.revertedWithCustomError(vaultPrudentContract, 'NotDao')
				.withArgs(owner.address);
		});
	});
	describe('Set fees percentage', () => {
		it('Should allow the DAO to change the fees percentage.', async () => {
			/* Arrange */
			const dao: HardhatEthersSigner = accounts.dao;
			const oldFeesBIPS = await vaultPrudentContract
				.connect(dao)
				.feesBIPS();

			/* Act */
			const feesBIPSTx = vaultPrudentContract
				.connect(dao)
				.setFeesBIPS(newFeesBIPS);

			/* Assert */
			await expect(feesBIPSTx)
				.to.emit(vaultPrudentContract, 'FeesBIPSChanged')
				.withArgs(oldFeesBIPS, newFeesBIPS);

			/* Act */
			const feesBIPS = await vaultPrudentContract.connect(dao).feesBIPS();

			/* Assert */
			expect(feesBIPS).to.equal(newFeesBIPS);
		});

		it("Shouldn't allow a non-DAO user to change the fees percentage.", async () => {
			/* Arrange */
			const poorUser: HardhatEthersSigner = accounts.poorUser;

			/* Act */
			const feesBIPSTx = vaultPrudentContract
				.connect(poorUser)
				.setFeesBIPS(newFeesBIPS);

			/* Assert */
			await expect(feesBIPSTx)
				.to.be.revertedWithCustomError(vaultPrudentContract, 'NotDao')
				.withArgs(poorUser.address);
		});

		it("Shouldn't allow owner to change the fees percentage.", async () => {
			/* Arrange */
			const owner: HardhatEthersSigner = accounts.owner;

			/* Act */
			const feesBIPSTx = vaultPrudentContract
				.connect(owner)
				.setFeesBIPS(newFeesBIPS);

			/* Assert */
			await expect(feesBIPSTx)
				.to.be.revertedWithCustomError(vaultPrudentContract, 'NotDao')
				.withArgs(owner.address);
		});
	});
});

describe('Getters functions', () => {
	let vaultPrudentContract: VaultPrudent;
	let accounts: Accounts;
	const expectedFeesBIPS = 500n;
	const expectedLiquidityBufferBIPS = 1000n;

	beforeEach(async () => {
		({ vaultPrudentContract, accounts } = await networkHelpers.loadFixture(
			deployFixture,
		));
	});

	it('Should return fees percentage to any user.', async () => {
		/* Arrange */

		/* Act */
		const feesBIPS = await vaultPrudentContract
			.connect(accounts.poorUser)
			.feesBIPS();

		/* Assert */
		expect(feesBIPS).to.equal(expectedFeesBIPS);
	});

	it('Should return liquidity buffer percentage to any user.', async () => {
		/* Arrange */

		/* Act */
		const liquidityBufferBIPS = await vaultPrudentContract
			.connect(accounts.poorUser)
			.liquidityBufferBIPS();

		/* Assert */
		expect(liquidityBufferBIPS).to.equal(expectedLiquidityBufferBIPS);
	});

	it('Should return DAO address to any user.', async () => {
		/* Arrange */
		const expectedDao = accounts.dao;

		/* Act */
		const dao = await vaultPrudentContract.connect(accounts.poorUser).dao();

		/* Assert */
		expect(dao).to.equal(expectedDao);
	});
});

describe('Vault - Business Logic', () => {
	let accounts: Accounts;
	let usdcContract: MockUSDC;
	let vaultPrudentContract: VaultPrudent;
	let usdcDepositAmount = ethers.parseUnits('1000', 6);

	beforeEach(async () => {
		({ usdcContract, vaultPrudentContract, accounts } =
			await networkHelpers.loadFixture(deployFixture));
	});
	describe('Deposits', () => {
		it('Should allow the user to deposit USDC, receive shares, and emit event.', async () => {
			/* Arrange & Act */
			const {
				shares: glUsdP,
				depositTx,
				vaultBalanceBefore,
				userBalanceBefore: whaleBalanceBefore,
				userSharesBefore: whaleGlUsdPBefore,
			} = await userDepositUsdc(
				accounts.whale,
				vaultPrudentContract,
				usdcContract,
				usdcDepositAmount,
			);

			/* Assert */
			// event Deposit
			await expect(depositTx)
				.to.emit(vaultPrudentContract, 'Deposit') // IERC4626 event Deposit
				.withArgs(
					accounts.whale.address,
					accounts.whale.address,
					usdcDepositAmount,
					glUsdP,
				);

			// Balances
			const [
				vaultBalanceAfter,
				whaleBalanceAfter,
				vaultTotalAssets,
				whaleGlUsdPAfter,
			] = await Promise.all([
				usdcContract.balanceOf(vaultPrudentContract.target),
				usdcContract.balanceOf(accounts.whale.address),
				vaultPrudentContract.totalAssets(),
				vaultPrudentContract.balanceOf(accounts.whale.address),
			]);

			expect(vaultBalanceAfter - vaultBalanceBefore).to.equal(
				usdcDepositAmount,
			);
			expect(whaleBalanceBefore - whaleBalanceAfter).to.equal(
				usdcDepositAmount,
			);
			expect(whaleGlUsdPAfter - whaleGlUsdPBefore).to.equal(glUsdP);
			expect(vaultTotalAssets - vaultBalanceBefore).to.equal(
				usdcDepositAmount,
			);
		});
	});
	it('Shouldn\t allow a poor user to deposit USDC.', async () => {
		/* Arrange & Act */
		const poorUserBalance = await usdcContract.balanceOf(
			accounts.poorUser.address,
		);

		/* Assert */
		// await expect(
		// 	userDepositUsdc(
		// 		accounts.poorUser,
		// 		vaultPrudentContract,
		// 		usdcContract,
		// 		usdcDepositAmount,
		// 	),
		// )
		// 	.to.be.revertedWithCustomError(
		// 		vaultPrudentContract,
		// 		'ERC20InsufficientAllowance',
		// 	)
		// 	.withArgs(
		// 		accounts.poorUser.address,
		// 		poorUserBalance,
		// 		usdcDepositAmount,
		// 	);
	});
	describe('Redeems', () => {
		let glUsdPToBurn = ethers.parseUnits('500', 6);

		it('Should allow the user to redeem USDC, burn glUSD-P, and emit event.', async () => {
			/* Arrange & Act */
			const { shares: glUsdP, depositTx } = await userDepositUsdc(
				accounts.whale,
				vaultPrudentContract,
				usdcContract,
				usdcDepositAmount,
			);

			await depositTx;
			await vaultPrudentContract
				.connect(accounts.whale)
				.approve(
					vaultPrudentContract.target,
					await vaultPrudentContract.balanceOf(
						accounts.whale.address,
					),
				);
			const {
				assets: usdcRedeemed,
				vaultBalanceBefore,
				userBalanceBefore: whaleBalanceBefore,
				userSharesBefore: whaleGlUsdPBefore,
				redeemTx,
			} = await userRedeemUsdc(
				accounts.whale,
				vaultPrudentContract,
				usdcContract,
				glUsdPToBurn,
			);

			/* Assert */
			// event Redeem
			await expect(redeemTx)
				.to.emit(vaultPrudentContract, 'Withdraw') // IERC4626 event Withdraw
				.withArgs(
					accounts.whale.address,
					accounts.whale.address,
					accounts.whale.address,
					usdcRedeemed,
					glUsdPToBurn,
				);

			// Balances
			const [
				vaultBalanceAfter,
				whaleBalanceAfter,
				vaultTotalAssets,
				whaleGlUsdPAfter,
			] = await Promise.all([
				usdcContract.balanceOf(vaultPrudentContract.target),
				usdcContract.balanceOf(accounts.whale.address),
				vaultPrudentContract.totalAssets(),
				vaultPrudentContract.balanceOf(accounts.whale.address),
			]);

			expect(vaultBalanceBefore - vaultBalanceAfter).to.equal(
				usdcRedeemed,
			);
			expect(whaleBalanceAfter - whaleBalanceBefore).to.equal(
				usdcRedeemed,
			);
			expect(whaleGlUsdPBefore - whaleGlUsdPAfter).to.equal(glUsdPToBurn);
			expect(vaultBalanceBefore - vaultTotalAssets).to.equal(
				usdcRedeemed,
			);
		});
	});
});

//npx hardhat test test/unit/VaultPrudent.test.ts --coverage
