import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("StableCoinWallet", function () {
  it("Should deploy with correct name and symbol", async function () {
    const [owner] = await ethers.getSigners();
    const StableCoinWallet = await ethers.getContractFactory("StableCoinWallet");
    const token = await StableCoinWallet.deploy(owner.address);
    await token.waitForDeployment();

    expect(await token.name()).to.equal("Stable Coin Wallet");
    expect(await token.symbol()).to.equal("SCW");
  });
});
