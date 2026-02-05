import { getContracts } from "../blockchain/contracts.js";
import { ethers } from "ethers";

export async function getWalletSummary(address) {
  const { stableCoinWallet } = getContracts({ write: false });

  // Example calls (adjust to your contract)
  // const balance = await stableCoinWallet.balanceOf(address);
  // const symbol = await stableCoinWallet.symbol();

  // If your StableCoinWallet has custom funcs, use those.
  // For now, demonstrate ERC20-style:
  const balance = await stableCoinWallet.balanceOf(address);
  const decimals = await stableCoinWallet.decimals();

  return {
    address,
    balance: ethers.formatUnits(balance, decimals),
    decimals: Number(decimals),
  };
}

export async function sendToken({ to, amount }) {
  const { stableCoinWallet } = getContracts({ write: true });

  const decimals = await stableCoinWallet.decimals();
  const amt = ethers.parseUnits(amount.toString(), decimals);

  const tx = await stableCoinWallet.transfer(to, amt);
  const receipt = await tx.wait();

  return { hash: tx.hash, status: receipt?.status ?? null };
}
