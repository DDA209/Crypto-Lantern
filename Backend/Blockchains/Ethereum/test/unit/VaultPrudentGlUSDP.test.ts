import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/types';
import { expect } from 'chai';
import { network } from 'hardhat';
import {
	MockERC20,
	VaultPrudentGlUSDP,
	MockAdapter,
} from '../../types/ethers-contracts/index.js';
import { Addressable, BigNumberish, ContractTransactionResponse } from 'ethers';

const { ethers, networkHelpers } = await network.connect();
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
	team: HardhatEthersSigner;
	newTeam: HardhatEthersSigner;
	poorUser: HardhatEthersSigner;
	whale: HardhatEthersSigner;
	attacker: HardhatEthersSigner;
}

const getAccounts = async (): Promise<Accounts> => {
	let [owner, dao, newDao, team, newTeam, poorUser, whale, attacker] =
		await ethers.getSigners();
	return { owner, dao, newDao, team, newTeam, poorUser, whale, attacker };
};

const deployFixture = async (): Promise<{
	accounts: Accounts;
	mockUSDC: MockERC20;
	vaultPrudentGlUSDP: VaultPrudentGlUSDP;
	mockAdapter1: MockAdapter;
	mockAdapter2: MockAdapter;
	depositTx: Promise<ContractTransactionResponse>;
}> => {
	// Get accounts
	const accounts = await getAccounts();

	// Deploy contracts
	const mockUSDC = (await ethers.deployContract('MockERC20', [
		'Mock USD',
		'USDC',
		6,
	])) as MockERC20;
	const vaultPrudentGlUSDP = (await ethers.deployContract(
		'VaultPrudentGlUSDP',
		[
			mockUSDC.target,
			accounts.dao.address,
			accounts.team.address,
			500n,
			1000n,
		],
	)) as VaultPrudentGlUSDP;
	const mockAdapter1 = (await ethers.deployContract('MockAdapter', [
		mockUSDC.target,
		vaultPrudentGlUSDP.target,
	])) as MockAdapter;
	const mockAdapter2 = (await ethers.deployContract('MockAdapter', [
		mockUSDC.target,
		vaultPrudentGlUSDP.target,
	])) as MockAdapter;

	// Mint some USDC to the whale
	const mintAmount = ethers.parseUnits('1000000', 6); // 1 000 000 USDC
	const approveTx = await mockUSDC
		.connect(accounts.whale)
		.approve(vaultPrudentGlUSDP.target, mintAmount);
	await approveTx.wait();
	await mockUSDC.mint(accounts.whale.address, mintAmount);

	// First deposit
	const depositTx = deposit(accounts.whale, vaultPrudentGlUSDP, 1000n);
	await (await depositTx).wait();

	// Return accounts and contracts
	return {
		accounts,
		mockUSDC,
		vaultPrudentGlUSDP,
		mockAdapter1,
		mockAdapter2,
		depositTx,
	};
};

const deposit = (
	user: HardhatEthersSigner,
	vaultPrudentGlUSDP: VaultPrudentGlUSDP,
	amount: BigNumberish,
	receiver?: Addressable,
): Promise<ContractTransactionResponse> => {
	const depositTx = vaultPrudentGlUSDP
		.connect(user)
		.deposit(amount, receiver ?? user.address);
	return depositTx;
};

//*
describe('1. Contract deployments', () => {
	let accounts: Accounts;
	let mockUSDC: MockERC20;
	beforeEach(async () => {
		({ accounts, mockUSDC } = await networkHelpers.loadFixture(
			deployFixture,
		));
	});
	describe('Deployment', () => {
		it('Should deploy the contract', async () => {
			const { vaultPrudentGlUSDP } = await deployFixture();
			const daoAddress = await vaultPrudentGlUSDP.daoAddress();
			const teamAddress = await vaultPrudentGlUSDP.teamAddress();
			const feesBIPS = await vaultPrudentGlUSDP.feesBIPS();
			const liquidityBufferBIPS =
				await vaultPrudentGlUSDP.liquidityBufferBIPS();
			expect(daoAddress).to.equal(accounts.dao.address);
			expect(teamAddress).to.equal(accounts.team.address);
			expect(feesBIPS).to.equal(500n);
			expect(liquidityBufferBIPS).to.equal(1000n);
		});
		it('Should revert if DAO address is 0', async () => {
			try {
				await ethers.deployContract('VaultPrudentGlUSDP', [
					mockUSDC.target,
					ethers.ZeroAddress,
					accounts.team.address,
					500n,
					1000n,
				]);
			} catch (error: any) {
				expect(error.message)
					.to.include('reverted with custom error')
					.and.to.include('AddressNotAllowed')
					.and.to.include(
						'0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
					)
					.and.to.include(ethers.ZeroAddress);
			}
		});
		it('Should revert if feesBIPS is not between 0 and 10000', async () => {
			try {
				await ethers.deployContract('VaultPrudentGlUSDP', [
					mockUSDC.target,
					accounts.dao.address,
					accounts.team.address,
					50000n,
					1000n,
				]);
			} catch (error: any) {
				expect(error.message)
					.to.include('reverted with custom error')
					.and.to.include('BadPercentage')
					.and.to.include(
						'0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
					)
					.and.to.include(50000n);
			}
		});
		it('Should revert if liquidityBufferBIPS is not between 0 and 10000', async () => {
			try {
				await ethers.deployContract('VaultPrudentGlUSDP', [
					mockUSDC.target,
					accounts.dao.address,
					accounts.team.address,
					500n,
					50000n,
				]);
			} catch (error: any) {
				expect(error.message)
					.to.include('reverted with custom error')
					.and.to.include(
						'0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
					)
					.and.to.include('BadPercentage')
					.and.to.include(50000n);
			}
		});
	});
	describe('Balance', () => {
		it('Should the whate has at least 100 000 USDC.', async () => {
			const whaleBalance = await mockUSDC.balanceOf(
				accounts.whale.address,
			);

			expect(whaleBalance).to.be.gte(100_000); // greaterThanOrEqual
		});
		it('Should the whale has anougth ETH to pay for gas fees.', async () => {
			const whaleBalance = await ethers.provider.getBalance(
				accounts.whale.address,
			);
			expect(whaleBalance).to.be.gte(1); // greaterThanOrEqual
		});
	});
}); // * /
describe('2.Contract Initalisation', () => {
	let accounts: Accounts;
	let vaultPrudentGlUSDP: VaultPrudentGlUSDP;
	let mockAdapter1: MockAdapter;
	let badStrategies: any;

	beforeEach(async () => {
		accounts = await networkHelpers.loadFixture(getAccounts);
		({ vaultPrudentGlUSDP, mockAdapter1 } =
			await networkHelpers.loadFixture(deployFixture));
		badStrategies = [
			// 110% total repartition
			[mockAdapter1.target, 6000, 100],
			[mockAdapter1.target, 5000, 100],
		];
	});
	describe('Initialisation', () => {
		it('Should deploy the contract', async () => {
			const daoAddress = await vaultPrudentGlUSDP.daoAddress();
			expect(daoAddress).to.equal(accounts.dao.address);
		});
		it('Should revert if strategies total repartition less than 100%', async () => {
			const defineStrategiesTx = vaultPrudentGlUSDP
				.connect(accounts.dao)
				.defineStrategies([badStrategies[0]]);

			await expect(defineStrategiesTx).to.be.revertedWithCustomError(
				vaultPrudentGlUSDP,
				'BadPercentage',
			);
		});
		it('Should revert if strategies total repartition is upper than 100%', async () => {
			const defineStrategiesTx = vaultPrudentGlUSDP
				.connect(accounts.dao)
				.defineStrategies(badStrategies);

			await expect(defineStrategiesTx).to.be.revertedWithCustomError(
				vaultPrudentGlUSDP,
				'BadPercentage',
			);
		});
	});
}); // * /
describe('3. DAO Governance & Configuration', () => {
	let accounts: Accounts;
	let vaultPrudentGlUSDP: VaultPrudentGlUSDP;
	let mockAdapter1: MockAdapter;
	let initialStrategies: any;
	let newStrategies: any;
	let badStrategies: any;

	beforeEach(async () => {
		accounts = await networkHelpers.loadFixture(getAccounts);
		({ vaultPrudentGlUSDP, mockAdapter1 } =
			await networkHelpers.loadFixture(deployFixture));
		initialStrategies = [
			// 60% - 40%
			[mockAdapter1.target, 6000n, 100n],
			[mockAdapter1.target, 4000n, 100n],
		];
		newStrategies = [
			// 70% - 30%
			[mockAdapter1.target, 7000n, 100n],
			[mockAdapter1.target, 3000n, 100n],
		];
		badStrategies = [
			// 110% total repartition
			[mockAdapter1.target, 6000n, 100n],
			[mockAdapter1.target, 5000n, 100n],
		];
	});
	describe('Access control', () => {
		describe('DAO address', () => {
			it('Should allow the DAO to change the DAO address', async () => {
				const setDAOAddressTx = vaultPrudentGlUSDP
					.connect(accounts.dao)
					.setDAOAddress(accounts.newDao.address);

				await expect(setDAOAddressTx)
					.to.emit(vaultPrudentGlUSDP, 'NewDAOAddressSetted')
					.withArgs(accounts.dao.address, accounts.newDao.address);

				const confirmNewDAOAddressTx = vaultPrudentGlUSDP
					.connect(accounts.newDao)
					.confirmNewDAOAddress();

				await expect(confirmNewDAOAddressTx)
					.to.emit(vaultPrudentGlUSDP, 'DAOAddressChangedConfirmed')
					.withArgs(accounts.dao.address, accounts.newDao.address);

				const newDaoAddress = await vaultPrudentGlUSDP.daoAddress();

				expect(newDaoAddress).to.equal(accounts.newDao.address);
			});
			it('Should revert if DAO address is 0', async () => {
				const setDAOAddressTx = vaultPrudentGlUSDP
					.connect(accounts.dao)
					.setDAOAddress(ethers.ZeroAddress);

				await expect(setDAOAddressTx).to.be.revertedWithCustomError(
					vaultPrudentGlUSDP,
					'AddressNotAllowed',
				);
			});
			it('Should revert if DAO address is contract address', async () => {
				const setDAOAddressTx = vaultPrudentGlUSDP
					.connect(accounts.dao)
					.setDAOAddress(vaultPrudentGlUSDP.target);

				await expect(setDAOAddressTx).to.be.revertedWithCustomError(
					vaultPrudentGlUSDP,
					'AddressNotAllowed',
				);
			});
			it('Should revert if non-DAO user tries to change the DAO address', async () => {
				const setDAOAddressTx = vaultPrudentGlUSDP
					.connect(accounts.attacker)
					.setDAOAddress(accounts.newDao.address);

				await expect(setDAOAddressTx).to.be.revertedWithCustomError(
					vaultPrudentGlUSDP,
					'NotADao',
				);
			});
			it('Should revert if owner tries to change the DAO', async () => {
				const setDAOAddressTx = vaultPrudentGlUSDP
					.connect(accounts.owner)
					.setDAOAddress(accounts.newDao.address);

				await expect(setDAOAddressTx).to.be.revertedWithCustomError(
					vaultPrudentGlUSDP,
					'NotADao',
				);
			});
			it('Sould revert if non-newDao tries ton confirm newDao address', async () => {
				await vaultPrudentGlUSDP
					.connect(accounts.dao)
					.setDAOAddress(accounts.newDao.address);

				const confirmNewDAOAddressTx = vaultPrudentGlUSDP
					.connect(accounts.attacker)
					.confirmNewDAOAddress();

				await expect(
					confirmNewDAOAddressTx,
				).to.be.revertedWithCustomError(vaultPrudentGlUSDP, 'NotADao');
			});
			it('Sould everyone read the dao address', async () => {
				const daoAddress = await vaultPrudentGlUSDP
					.connect(accounts.attacker)
					.daoAddress();
				expect(daoAddress).to.equal(accounts.dao.address);
			});
			it('Sould allow everyone to read the new DAO address setted', async () => {
				let newDaoAddress = await vaultPrudentGlUSDP
					.connect(accounts.attacker)
					.newDaoAddress();
				expect(newDaoAddress).to.equal(ethers.ZeroAddress);

				await vaultPrudentGlUSDP
					.connect(accounts.dao)
					.setDAOAddress(accounts.newDao.address);
				newDaoAddress = await vaultPrudentGlUSDP
					.connect(accounts.attacker)
					.newDaoAddress();

				expect(newDaoAddress).to.equal(accounts.newDao.address);
			});
		});
		describe('Team address', () => {
			it('Should allow the team to change the team address', async () => {
				const setTeamAddressTx = vaultPrudentGlUSDP
					.connect(accounts.team)
					.setTeamAddress(accounts.newTeam.address);

				await expect(setTeamAddressTx)
					.to.emit(vaultPrudentGlUSDP, 'NewTeamAddressSetted')
					.withArgs(accounts.team.address, accounts.newTeam.address);

				const confirmNewTeamAddressTx = vaultPrudentGlUSDP
					.connect(accounts.newTeam)
					.confirmNewTeamAddress();

				await expect(confirmNewTeamAddressTx)
					.to.emit(vaultPrudentGlUSDP, 'TeamAddressChangedConfirmed')
					.withArgs(accounts.team.address, accounts.newTeam.address);

				const newTeamAddress = await vaultPrudentGlUSDP.teamAddress();

				expect(newTeamAddress).to.equal(accounts.newTeam.address);
			});
			it('Should revert if team address is 0', async () => {
				const setTeamAddressTx = vaultPrudentGlUSDP
					.connect(accounts.team)
					.setTeamAddress(ethers.ZeroAddress);

				await expect(setTeamAddressTx).to.be.revertedWithCustomError(
					vaultPrudentGlUSDP,
					'AddressNotAllowed',
				);
			});
			it('Should revert if team address is contract address', async () => {
				const setTeamAddressTx = vaultPrudentGlUSDP
					.connect(accounts.team)
					.setTeamAddress(vaultPrudentGlUSDP.target);

				await expect(setTeamAddressTx).to.be.revertedWithCustomError(
					vaultPrudentGlUSDP,
					'AddressNotAllowed',
				);
			});
			it('Should revert if non-team user tries to change the team address', async () => {
				const setTeamAddressTx = vaultPrudentGlUSDP
					.connect(accounts.attacker)
					.setTeamAddress(accounts.newTeam.address);

				await expect(setTeamAddressTx).to.be.revertedWithCustomError(
					vaultPrudentGlUSDP,
					'NotATeam',
				);
			});
			it('Should revert if owner tries to change the team', async () => {
				const setTeamAddressTx = vaultPrudentGlUSDP
					.connect(accounts.owner)
					.setTeamAddress(accounts.newTeam.address);

				await expect(setTeamAddressTx).to.be.revertedWithCustomError(
					vaultPrudentGlUSDP,
					'NotATeam',
				);
			});
			it('Sould revert if non-newTeam tries ton confirm newTeam address', async () => {
				await vaultPrudentGlUSDP
					.connect(accounts.team)
					.setTeamAddress(accounts.newTeam.address);

				const confirmNewTeamAddressTx = vaultPrudentGlUSDP
					.connect(accounts.attacker)
					.confirmNewTeamAddress();

				await expect(
					confirmNewTeamAddressTx,
				).to.be.revertedWithCustomError(vaultPrudentGlUSDP, 'NotATeam');
			});
			it('Sould everyone read the team address', async () => {
				const teamAddress = await vaultPrudentGlUSDP
					.connect(accounts.attacker)
					.teamAddress();
				expect(teamAddress).to.equal(accounts.team.address);
			});
			it('Sould allow everyone to read the new team address setted', async () => {
				let newTeamAddress = await vaultPrudentGlUSDP
					.connect(accounts.attacker)
					.newTeamAddress();
				expect(newTeamAddress).to.equal(ethers.ZeroAddress);

				await vaultPrudentGlUSDP
					.connect(accounts.team)
					.setTeamAddress(accounts.newTeam.address);
				newTeamAddress = await vaultPrudentGlUSDP
					.connect(accounts.attacker)
					.newTeamAddress();

				expect(newTeamAddress).to.equal(accounts.newTeam.address);
			});
		});
	});
	describe('Fees', () => {
		it('Should allow the DAO to change the fees percentage', async () => {
			const setFeesBIPSTx = vaultPrudentGlUSDP
				.connect(accounts.dao)
				.setFeesBIPS(800);

			await expect(setFeesBIPSTx)
				.to.emit(vaultPrudentGlUSDP, 'FeesBIPSChanged')
				.withArgs(500n, 800n);

			const feesBIPS = await vaultPrudentGlUSDP
				.connect(accounts.dao)
				.feesBIPS();
			expect(feesBIPS).to.equal(800n);
		});
		it('Should revert if feesBIPS upper than 10000', async () => {
			const setFeesBIPSTx = vaultPrudentGlUSDP
				.connect(accounts.dao)
				.setFeesBIPS(10001n);

			await expect(setFeesBIPSTx).to.be.revertedWithCustomError(
				vaultPrudentGlUSDP,
				'BadPercentage',
			);
		});
		it('Should revert if feesBIPS less than 0', async () => {
			try {
				await vaultPrudentGlUSDP.connect(accounts.dao).setFeesBIPS(-1n);
			} catch (error: any) {
				expect(error.message)
					.to.include('feesBIPS')
					.and.to.include('-1')
					.and.to.include('INVALID_ARGUMENT');
			}
		});
		it('Should revert if non-DAO user tries to change the fees', async () => {
			const setFeesBIPSTx = vaultPrudentGlUSDP
				.connect(accounts.attacker)
				.setFeesBIPS(800n);

			await expect(setFeesBIPSTx).to.be.revertedWithCustomError(
				vaultPrudentGlUSDP,
				'NotADao',
			);
		});
		it('Should allow everyone to read the fees', async () => {
			const feesBIPS = await vaultPrudentGlUSDP
				.connect(accounts.attacker)
				.feesBIPS();
			expect(feesBIPS).to.equal(500n);
		});
	});
	describe('Liquidity Buffer', () => {
		it('Should allow the DAO to change the liquidity buffer', async () => {
			const setLiquidityBufferBIPSTx = vaultPrudentGlUSDP
				.connect(accounts.dao)
				.setLiquidityBufferBIPS(800);

			await expect(setLiquidityBufferBIPSTx)
				.to.emit(vaultPrudentGlUSDP, 'LiquidityBufferBIPSChanged')
				.withArgs(1000n, 800n);

			const liquidityBufferBIPS = await vaultPrudentGlUSDP
				.connect(accounts.dao)
				.liquidityBufferBIPS();
			expect(liquidityBufferBIPS).to.equal(800n);
		});
		it('Should revert if liquidityBufferBIPS upper than 10000', async () => {
			const setLiquidityBufferBIPSTx = vaultPrudentGlUSDP
				.connect(accounts.dao)
				.setLiquidityBufferBIPS(10001n);

			await expect(
				setLiquidityBufferBIPSTx,
			).to.be.revertedWithCustomError(
				vaultPrudentGlUSDP,
				'BadPercentage',
			);
		});
		it('Should revert if liquidityBufferBIPS less than 0', async () => {
			try {
				await vaultPrudentGlUSDP
					.connect(accounts.dao)
					.setLiquidityBufferBIPS(-1n);
			} catch (error: any) {
				expect(error.message)
					.to.include('liquidityBufferBIPS')
					.and.to.include('-1')
					.and.to.include('INVALID_ARGUMENT');
			}
		});
		it('Should revert if non-DAO user tries to change the liquidity buffer', async () => {
			const setLiquidityBufferBIPSTx = vaultPrudentGlUSDP
				.connect(accounts.attacker)
				.setLiquidityBufferBIPS(800n);

			await expect(
				setLiquidityBufferBIPSTx,
			).to.be.revertedWithCustomError(vaultPrudentGlUSDP, 'NotADao');
		});
		it('Should allow everyone to read the liquidity buffer', async () => {
			const liquidityBufferBIPS = await vaultPrudentGlUSDP
				.connect(accounts.attacker)
				.liquidityBufferBIPS();
			expect(liquidityBufferBIPS).to.equal(1000n);
		});
	});
	describe('Strategies', () => {
		it('Should allow the DAO to define the strategies', async () => {
			const setStrategiesTx = vaultPrudentGlUSDP
				.connect(accounts.dao)
				.defineStrategies(initialStrategies);

			await expect(setStrategiesTx)
				.to.emit(vaultPrudentGlUSDP, 'StrategiesChanged')
				.withArgs(initialStrategies);

			const strategy0 = await vaultPrudentGlUSDP
				.connect(accounts.dao)
				.strategies(0);
			const strategy1 = await vaultPrudentGlUSDP
				.connect(accounts.dao)
				.strategies(1);

			expect(strategy0).to.deep.equal(initialStrategies[0]);
			expect(strategy1).to.deep.equal(initialStrategies[1]);
		});
		it('Should allow the DAO to change the strategies', async () => {
			await vaultPrudentGlUSDP
				.connect(accounts.dao)
				.defineStrategies(initialStrategies);
			const setStrategiesTx = vaultPrudentGlUSDP
				.connect(accounts.dao)
				.defineStrategies(newStrategies);

			await expect(setStrategiesTx)
				.to.emit(vaultPrudentGlUSDP, 'StrategiesChanged')
				.withArgs(newStrategies);

			const strategy0 = await vaultPrudentGlUSDP
				.connect(accounts.dao)
				.strategies(0);
			const strategy1 = await vaultPrudentGlUSDP
				.connect(accounts.dao)
				.strategies(1);

			expect(strategy0).to.deep.equal(newStrategies[0]);
			expect(strategy1).to.deep.equal(newStrategies[1]);
		});
		it('Should revert if the sum of the strategies is not 10000', async () => {
			const setStrategiesTx = vaultPrudentGlUSDP
				.connect(accounts.dao)
				.defineStrategies(badStrategies);

			await expect(setStrategiesTx).to.be.revertedWithCustomError(
				vaultPrudentGlUSDP,
				'BadPercentage',
			);
		});
		it('Should revert if non-DAO user tries to change the strategies', async () => {
			const setStrategiesTx = vaultPrudentGlUSDP
				.connect(accounts.attacker)
				.defineStrategies(initialStrategies);

			await expect(setStrategiesTx).to.be.revertedWithCustomError(
				vaultPrudentGlUSDP,
				'NotADao',
			);
		});
		it('Should allow everyone to read the strategies', async () => {
			await vaultPrudentGlUSDP
				.connect(accounts.dao)
				.defineStrategies(initialStrategies);

			const strategy0 = await vaultPrudentGlUSDP
				.connect(accounts.attacker)
				.strategies(0);

			expect(strategy0).to.deep.equal(initialStrategies[0]);
		});
		it('Should allow everyone to read undefined strategies', async () => {
			const strategy0 = vaultPrudentGlUSDP
				.connect(accounts.attacker)
				.strategies(0);

			await expect(strategy0).to.be.revertedWithoutReason(ethers);
		});
	});
}); // * /
describe('4. Basic Vault Accounting', () => {
	let accounts: Accounts;
	let vaultPrudentGlUSDP: VaultPrudentGlUSDP;
	let mockAdapter1: MockAdapter;
	let mockUSDC: MockERC20;

	beforeEach(async () => {
		accounts = await networkHelpers.loadFixture(getAccounts);
		({ vaultPrudentGlUSDP, mockAdapter1, mockUSDC } =
			await networkHelpers.loadFixture(deployFixture));
		await vaultPrudentGlUSDP.connect(accounts.dao).defineStrategies([
			{
				adapter: mockAdapter1.target,
				repartitionBIPS: 10000n,
				deltaBIPS: 100n,
			},
		]);
	});
	describe('Deposit', () => {
		it('Should allow users to deposit assets', async () => {
			const userSharesBalanceBefore = await vaultPrudentGlUSDP.balanceOf(
				accounts.whale.address,
			);
			const vaultTotalAssetsBefore =
				await vaultPrudentGlUSDP.totalAssets();
			const lastTotalAssetsBefore =
				await vaultPrudentGlUSDP.lastTotalAssets();
			const userBalanceBefore = await mockUSDC.balanceOf(
				accounts.whale.address,
			);
			const amountToDeposit = 2000n;

			const depositTx = deposit(
				accounts.whale,
				vaultPrudentGlUSDP,
				amountToDeposit,
			);

			await expect(depositTx)
				.to.emit(vaultPrudentGlUSDP, 'Deposit')
				.withArgs(
					accounts.whale.address,
					accounts.whale.address,
					amountToDeposit,
					amountToDeposit,
				);

			const userSharesBalance = await vaultPrudentGlUSDP.balanceOf(
				accounts.whale.address,
			);
			const vaultTotalAssets = await vaultPrudentGlUSDP.totalAssets();
			const lastTotalAssets = await vaultPrudentGlUSDP.lastTotalAssets();
			const userBalance = await mockUSDC.balanceOf(
				accounts.whale.address,
			);

			expect(userSharesBalance).to.equal(
				userSharesBalanceBefore + amountToDeposit,
			);
			expect(vaultTotalAssets).to.equal(
				vaultTotalAssetsBefore + amountToDeposit,
			);
			expect(lastTotalAssets).to.equal(
				lastTotalAssetsBefore + amountToDeposit,
			);
			expect(userBalance).to.equal(userBalanceBefore - amountToDeposit);
		});
		it('Should revert if amount is zero', async () => {
			const depositTx = deposit(accounts.whale, vaultPrudentGlUSDP, 0n);

			await expect(depositTx).to.be.revertedWithCustomError(
				vaultPrudentGlUSDP,
				'NotAmountZero',
			);
		});
		it('Should revert if amount is greater than user balance', async () => {
			const depositTx = deposit(
				accounts.whale,
				vaultPrudentGlUSDP,
				1000000000000000000000000n,
			);

			await expect(depositTx).to.be.revertedWithCustomError(
				vaultPrudentGlUSDP,
				'ERC20InsufficientAllowance',
			);
		});
		it('Should revert if deposit receiver address is zero', async () => {
			const depositTx = deposit(
				accounts.whale,
				vaultPrudentGlUSDP,
				2000n,
				ethers.ZeroAddress as unknown as Addressable,
			);

			await expect(depositTx).to.be.revertedWithCustomError(
				vaultPrudentGlUSDP,
				'AddressNotAllowed',
			);
		});
	});
}); // */
describe('5. Asset Management & Rebalancing', () => {
	let accounts: Accounts;
	let vaultPrudentGlUSDP: VaultPrudentGlUSDP;
	let mockAdapter1: MockAdapter;
	let mockAdapter2: MockAdapter;
	let mockUSDC: MockERC20;

	beforeEach(async () => {
		accounts = await networkHelpers.loadFixture(getAccounts);
		({ vaultPrudentGlUSDP, mockAdapter1, mockAdapter2, mockUSDC } =
			await networkHelpers.loadFixture(deployFixture));
		await vaultPrudentGlUSDP.connect(accounts.dao).defineStrategies([
			{
				adapter: mockAdapter1.target,
				repartitionBIPS: 2000n,
				deltaBIPS: 100n,
			},
			{
				adapter: mockAdapter2.target,
				repartitionBIPS: 8000n,
				deltaBIPS: 100n,
			},
		]);
	});
	describe('Rebalance', () => {
		it('Should allow the DAO to rebalance the vault', async () => {
			const rebalanceTx = vaultPrudentGlUSDP
				.connect(accounts.dao)
				.forceRebalance();

			await expect(rebalanceTx)
				.to.emit(vaultPrudentGlUSDP, 'Rebalance')
				.withArgs(true, 1000n, 100n, 900n, 900n);

			const vaultBufferAssets = await mockUSDC
				.connect(accounts.dao)
				.balanceOf(vaultPrudentGlUSDP.target);

			expect(vaultBufferAssets).to.equal(100n);
		});
		it('Should revert if non-DAO user tries to rebalance', async () => {
			const rebalanceTx = vaultPrudentGlUSDP
				.connect(accounts.attacker)
				.forceRebalance();

			await expect(rebalanceTx).to.be.revertedWithCustomError(
				vaultPrudentGlUSDP,
				'NotADao',
			);
		});
		it('Should allow everyone to read the invested assets', async () => {
			await vaultPrudentGlUSDP.connect(accounts.dao).forceRebalance();
			const adapter1InvestedAssets = await mockAdapter1
				.connect(accounts.attacker)
				.getInvestedAssets();
			const adapter2InvestedAssets = await mockAdapter2
				.connect(accounts.attacker)
				.getInvestedAssets();
			const vaultBufferAssets = await mockUSDC
				.connect(accounts.attacker)
				.balanceOf(vaultPrudentGlUSDP.target);

			expect(adapter1InvestedAssets).to.equal(180n);
			expect(adapter2InvestedAssets).to.equal(720n);
			expect(vaultBufferAssets).to.equal(100n);
		});
	});
}); // */
describe('6. Yield, Fees & Harvest', () => {
	let accounts: Accounts;
	let vaultPrudentGlUSDP: VaultPrudentGlUSDP;
	let mockAdapter1: MockAdapter;
	let mockAdapter2: MockAdapter;
	let mockUSDC: MockERC20;

	beforeEach(async () => {
		accounts = await networkHelpers.loadFixture(getAccounts);
		({ vaultPrudentGlUSDP, mockAdapter1, mockAdapter2, mockUSDC } =
			await networkHelpers.loadFixture(deployFixture));
		await vaultPrudentGlUSDP.connect(accounts.dao).defineStrategies([
			{
				adapter: mockAdapter1.target,
				repartitionBIPS: 2000n,
				deltaBIPS: 100n,
			},
			{
				adapter: mockAdapter2.target,
				repartitionBIPS: 8000n,
				deltaBIPS: 100n,
			},
		]);
		await vaultPrudentGlUSDP.connect(accounts.dao).setFeesBIPS(500);
	});
	describe('Harvest', () => {
		it('Should allow the DAO to harvest yield', async () => {
			const harvestTx = vaultPrudentGlUSDP
				.connect(accounts.team)
				.harvest();
			await expect(harvestTx)
				.to.emit(vaultPrudentGlUSDP, 'Harvest')
				.withArgs(0n, 0n, 0n, 1000n);
		});
		it('Should the strategies generate yield', async () => {
			// TVL origin: 180 + 720 + 100 = 1000;
			// new TVL: 850 + 650 + 100 = 1600;
			// yield: 600 ;
			// fees: 600 * 0.05 = 30
			// new shares: 30 * 1000 / 1000 = 30
			// new total assets: 1600 + 30 = 1630
			// new share price: 1630 / 1000 = 1.63
			// new repartition: 163 for buffer; 1467 for strategies
			//                  1467 * 0.2 = 293.4; 1467 * 0.8 = 1173.6
			await vaultPrudentGlUSDP.connect(accounts.dao).forceRebalance();
			await mockAdapter1.setMockAssets(850n); // + 670
			await mockUSDC.mint(mockAdapter1.target, 670n);
			await mockAdapter2.setMockAssets(650n); // - 70
			await mockUSDC.burn(mockAdapter2.target, 70n);

			const harvestTx = vaultPrudentGlUSDP
				.connect(accounts.team)
				.harvest();
			await expect(harvestTx)
				.to.emit(vaultPrudentGlUSDP, 'Harvest')
				.withArgs(600n, 30n, 18n, 1600n);
		});
		it('Should revert if non-DAO user tries to harvest', async () => {
			const harvestTx = vaultPrudentGlUSDP
				.connect(accounts.attacker)
				.harvest();

			await expect(harvestTx).to.be.revertedWithCustomError(
				vaultPrudentGlUSDP,
				'NotATeam',
			);
		});
	});
}); // */
describe('7. Withdrawals & Force Divest', () => {
	let accounts: Accounts;
	let vaultPrudentGlUSDP: VaultPrudentGlUSDP;
	let mockAdapter1: MockAdapter;
	let mockAdapter2: MockAdapter;
	let mockUSDC: MockERC20;

	beforeEach(async () => {
		accounts = await networkHelpers.loadFixture(getAccounts);
		({ vaultPrudentGlUSDP, mockAdapter1, mockAdapter2, mockUSDC } =
			await networkHelpers.loadFixture(deployFixture));
		await vaultPrudentGlUSDP.connect(accounts.dao).defineStrategies([
			{
				adapter: mockAdapter1.target,
				repartitionBIPS: 2000n,
				deltaBIPS: 100n,
			},
			{
				adapter: mockAdapter2.target,
				repartitionBIPS: 8000n,
				deltaBIPS: 100n,
			},
		]);
		await vaultPrudentGlUSDP.connect(accounts.dao).setFeesBIPS(500);
		await Promise.all([
			mockAdapter1.setMockAssets(1000n),
			mockUSDC.mint(mockAdapter1.target, 1000n),
			mockAdapter2.setMockAssets(4500n),
			mockUSDC.mint(mockAdapter2.target, 4500n),
		]);
		await vaultPrudentGlUSDP.connect(accounts.team).harvest();
	});
	describe('Withdrawals', () => {
		it('Should allow the user to withdraw assets on buffer', async () => {
			const bufferBefore = await mockUSDC.balanceOf(
				vaultPrudentGlUSDP.target,
			);
			const withdrawTx = vaultPrudentGlUSDP
				.connect(accounts.whale)
				.withdraw(500n, accounts.whale.address, accounts.whale.address);
			await expect(withdrawTx)
				.to.emit(vaultPrudentGlUSDP, 'Withdraw')
				.withArgs(
					accounts.whale.address,
					accounts.whale.address,
					accounts.whale.address,
					500n,
					81n,
				);
			const bufferAfter = await mockUSDC.balanceOf(
				vaultPrudentGlUSDP.target,
			);
			expect(bufferAfter).to.equal(bufferBefore - 500n);
		});
		it('Should allow the user to force withdraw assets on buffer and strategies', async () => {
			const bufferBefore = await mockUSDC.balanceOf(
				// 650
				vaultPrudentGlUSDP.target,
			);
			const strategy1BalanceBefore = await mockUSDC.balanceOf(
				// 1170
				mockAdapter1.target,
			);
			const strategy2BalanceBefore = await mockUSDC.balanceOf(
				// 4680
				mockAdapter2.target,
			);

			const withdrawTx = vaultPrudentGlUSDP
				.connect(accounts.whale)
				.withdraw(
					1200n,
					accounts.whale.address,
					accounts.whale.address,
				);
			await expect(withdrawTx)
				.to.emit(vaultPrudentGlUSDP, 'Withdraw')
				.withArgs(
					accounts.whale.address,
					accounts.whale.address,
					accounts.whale.address,
					1200n,
					193n,
				);
			const strategiesDivested = 1200n - bufferBefore; // 1200 - 650 = 550
			const strategy1Divested = (strategiesDivested * 200n) / 1000n; // 550 * 0.2 = 110
			const strategy2Divested = (strategiesDivested * 800n) / 1000n; // 550 * 0.8 = 440

			const strategy1BalanceAfter = await mockUSDC.balanceOf(
				mockAdapter1.target,
			);
			const strategy2BalanceAfter = await mockUSDC.balanceOf(
				mockAdapter2.target,
			);

			expect(strategy1BalanceAfter).to.equal(
				strategy1BalanceBefore - strategy1Divested, // 1170 - 110 = 1060
			);
			expect(strategy2BalanceAfter).to.equal(
				strategy2BalanceBefore - strategy2Divested, // 4680 - 440 = 4240
			);
		});
		it('Should revert if amount is greater than user balance', async () => {
			const withdrawTx = vaultPrudentGlUSDP
				.connect(accounts.whale)
				.withdraw(
					8000n,
					accounts.whale.address,
					accounts.whale.address,
				);
			await expect(withdrawTx).to.be.revertedWithCustomError(
				vaultPrudentGlUSDP,
				'BadAmount',
			);
		});
		it('Should revert if amount is zero', async () => {
			const withdrawTx = vaultPrudentGlUSDP
				.connect(accounts.whale)
				.withdraw(0n, accounts.whale.address, accounts.whale.address);
			await expect(withdrawTx).to.be.revertedWithCustomError(
				vaultPrudentGlUSDP,
				'NotAmountZero',
			);
		});
		it('Should revert if withdrawal receiver address is zero', async () => {
			const withdrawTx = vaultPrudentGlUSDP
				.connect(accounts.whale)
				.withdraw(500n, ethers.ZeroAddress, ethers.ZeroAddress);
			await expect(withdrawTx).to.be.revertedWithCustomError(
				vaultPrudentGlUSDP,
				'AddressNotAllowed',
			);
		});
		it('Should revert if withdrawal receiver address is not allowed', async () => {});
	});
}); // */
describe('8. Read Functions', () => {
	let accounts: Accounts;
	let vaultPrudentGlUSDP: VaultPrudentGlUSDP;
	let mockAdapter1: MockAdapter;
	let mockAdapter2: MockAdapter;
	let mockUSDC: MockERC20;

	beforeEach(async () => {
		accounts = await networkHelpers.loadFixture(getAccounts);
		({ vaultPrudentGlUSDP, mockAdapter1, mockAdapter2, mockUSDC } =
			await networkHelpers.loadFixture(deployFixture));
		await vaultPrudentGlUSDP.connect(accounts.dao).defineStrategies([
			{
				adapter: mockAdapter1.target,
				repartitionBIPS: 2000n,
				deltaBIPS: 100n,
			},
			{
				adapter: mockAdapter2.target,
				repartitionBIPS: 8000n,
				deltaBIPS: 100n,
			},
		]);
		await vaultPrudentGlUSDP.connect(accounts.dao).setFeesBIPS(500);
		await Promise.all([
			mockAdapter1.setMockAssets(1000n),
			mockUSDC.mint(mockAdapter1.target, 1000n),
			mockAdapter2.setMockAssets(4500n),
			mockUSDC.mint(mockAdapter2.target, 4500n),
		]);
		await vaultPrudentGlUSDP.connect(accounts.team).harvest();
	});
	describe('Read Functions', () => {
		it('Should everyone be able to read the vault address', async () => {
			expect(await vaultPrudentGlUSDP.getAddress()).to.equal(
				vaultPrudentGlUSDP.target,
			);
		});
		it('Should everyone be able to read the DAO address', async () => {
			expect(await vaultPrudentGlUSDP.daoAddress()).to.equal(
				accounts.dao.address,
			);
		});
		it('Should everyone be able to read the strategies', async () => {
			expect(await vaultPrudentGlUSDP.strategies(0)).to.deep.equal([
				mockAdapter1.target,
				2000n,
				100n,
			]);
			expect(await vaultPrudentGlUSDP.strategies(1)).to.deep.equal([
				mockAdapter2.target,
				8000n,
				100n,
			]);
		});
		it('Should everyone be able to read the fees', async () => {
			expect(await vaultPrudentGlUSDP.feesBIPS()).to.equal(500n);
		});
		it('Should everyone be able to read the total assets', async () => {
			expect(await vaultPrudentGlUSDP.totalAssets()).to.equal(6500n);
		});
		it('Should everyone be able to read the total shares', async () => {
			expect(await vaultPrudentGlUSDP.totalSupply()).to.equal(1042n);
		});
		it('Should everyone be able to read the buffer total assets', async () => {
			expect(await vaultPrudentGlUSDP.getBufferTotalAssets()).to.equal(
				650n,
			);
		});
		it('Should everyone be able to read the DAO total shares', async () => {
			expect(
				await vaultPrudentGlUSDP.balanceOf(accounts.dao.address),
			).to.equal(42n);
		});
		it('Should everyone be able to read user total shares', async () => {
			expect(
				await vaultPrudentGlUSDP.balanceOf(accounts.whale.address),
			).to.equal(1000n);
		});
	});
}); // */
