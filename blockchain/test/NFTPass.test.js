import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("NFTPass", function () {
  let nftPass;
  let owner, minter, user;

  beforeEach(async function () {
    [owner, minter, user] = await ethers.getSigners();
    const NFTPass = await ethers.getContractFactory("NFTPass");
    nftPass = await NFTPass.deploy(owner.address);
    await nftPass.waitForDeployment();
  });

  it("should have correct name and symbol", async function () {
    expect(await nftPass.name()).to.equal("Wallet NFT Pass");
    expect(await nftPass.symbol()).to.equal("WNFT");
  });

  it("should mint to user when called by minter", async function () {
    const tokenUri = "https://example.com/1.json";
    const tx = await nftPass.connect(owner).mint(user.address, tokenUri);
    const receipt = await tx.wait();
    expect(await nftPass.ownerOf(1)).to.equal(user.address);
    expect(await nftPass.tokenURI(1)).to.equal(tokenUri);
  });

  it("should revert mint when not minter", async function () {
    await nftPass.grantRole(await nftPass.MINTER_ROLE(), minter.address);
    try {
      await nftPass.connect(user).mint(user.address, "https://x.com/1.json");
      expect.fail("expected revert");
    } catch (e) {
      expect(e.message || e.toString()).to.match(/revert|unauthorized|denied/i);
    }
  });
});
