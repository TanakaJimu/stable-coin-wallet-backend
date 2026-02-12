import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("Vault", function () {
  let vault, stableToken;
  let owner, operator, user;

  beforeEach(async function () {
    [owner, operator, user] = await ethers.getSigners();
    const StableToken = await ethers.getContractFactory("StableToken");
    stableToken = await StableToken.deploy(owner.address);
    await stableToken.waitForDeployment();
    const Vault = await ethers.getContractFactory("Vault");
    vault = await Vault.deploy(owner.address);
    await vault.waitForDeployment();
    await stableToken.mint(user.address, ethers.parseUnits("1000", 18));
  });

  it("should accept deposit after approve", async function () {
    const amount = ethers.parseUnits("50", 18);
    await stableToken.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).deposit(await stableToken.getAddress(), amount, "ref-1");
    expect(await stableToken.balanceOf(await vault.getAddress())).to.equal(amount);
  });

  it("should allow operator to withdrawTo", async function () {
    const amount = ethers.parseUnits("50", 18);
    await stableToken.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).deposit(await stableToken.getAddress(), amount, "ref-1");
    const OPERATOR_ROLE = await vault.OPERATOR_ROLE();
    await vault.grantRole(OPERATOR_ROLE, operator.address);
    await vault.connect(operator).withdrawTo(await stableToken.getAddress(), operator.address, amount, "withdraw-1");
    expect(await stableToken.balanceOf(operator.address)).to.equal(amount);
  });

  it("should revert withdrawTo when not operator", async function () {
    const amount = ethers.parseUnits("50", 18);
    await stableToken.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).deposit(await stableToken.getAddress(), amount, "ref-1");
    try {
      await vault.connect(user).withdrawTo(await stableToken.getAddress(), user.address, amount, "x");
      expect.fail("expected revert");
    } catch (e) {
      expect(e.message || e.toString()).to.match(/revert|unauthorized|denied/i);
    }
  });
});
