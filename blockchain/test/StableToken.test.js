import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("StableToken", function () {
  let stableToken;
  let owner;
  let minter;
  let user;

  beforeEach(async function () {
    [owner, minter, user] = await ethers.getSigners();
    const StableToken = await ethers.getContractFactory("StableToken");
    stableToken = await StableToken.deploy(owner.address);
    await stableToken.waitForDeployment();
  });

  it("should have correct name and symbol", async function () {
    expect(await stableToken.name()).to.equal("Stable Wallet Coin");
    expect(await stableToken.symbol()).to.equal("SWC");
  });

  it("should grant MINTER_ROLE to deployer", async function () {
    const MINTER_ROLE = await stableToken.MINTER_ROLE();
    expect(await stableToken.hasRole(MINTER_ROLE, owner.address)).to.be.true;
  });

  it("should mint when called by minter", async function () {
    const amount = ethers.parseUnits("100", 18);
    await stableToken.connect(owner).mint(user.address, amount);
    expect(await stableToken.balanceOf(user.address)).to.equal(amount);
  });

  it("should revert mint when not minter", async function () {
    const amount = ethers.parseUnits("100", 18);
    try {
      await stableToken.connect(user).mint(user.address, amount);
      expect.fail("expected revert");
    } catch (e) {
      expect(e.message || e.toString()).to.match(/revert|unauthorized|denied/i);
    }
  });

  it("should pause and unpause", async function () {
    await stableToken.mint(user.address, ethers.parseUnits("1", 18));
    await stableToken.pause();
    try {
      await stableToken.connect(user).transfer(owner.address, 1);
      expect.fail("expected revert");
    } catch (e) {
      expect(e.message || e.toString()).to.match(/revert|pause/i);
    }
    await stableToken.unpause();
    await stableToken.connect(user).transfer(owner.address, 1);
    expect(await stableToken.balanceOf(owner.address)).to.equal(1n);
  });
});
