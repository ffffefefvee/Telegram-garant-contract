/**
 * End-to-end smoke test against a deployed testnet.
 *
 * Prereqs (see `scripts/deploy.ts` output):
 *   - `deployments/<network>.json` exists with the 5 contract addresses
 *   - The deployer wallet (PRIVATE_KEY) has POL for gas + can mint MockERC20
 *     (MockERC20's `mint` is open to anyone per `contracts/mocks/MockERC20.sol`)
 *   - The deployer holds ADMIN_ROLE on Registry (true when deployer === admin)
 *
 * What it does:
 *   1. Generates throwaway buyer / seller / arbitrator wallets
 *   2. Funds each with a small amount of POL for gas
 *   3. Mints MockERC20 to buyer + arbitrator (for fund + stake respectively)
 *   4. HAPPY PATH: createEscrow → buyer transfers to clone → notifyFunded → buyer releases → verifies seller got payout, treasury got fee
 *   5. DISPUTE PATH: new deal → fund → buyer disputes → relay assigns arbitrator → arbitrator resolves 70/30
 *
 * Captures every tx hash and prints a summary at the end for pasting into the
 * smoke-test PR description. PolygonScan URLs are auto-printed for Amoy.
 *
 * Run:
 *   npm run smoke:amoy    (after `npm run deploy:amoy`)
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

type Deployment = {
  network: string;
  deployer: string;
  relay: string;
  admin: string;
  contracts: {
    token: string;
    treasury: string;
    registry: string;
    implementation: string;
    factory: string;
  };
};

const USDT = (n: string | number) => ethers.parseUnits(String(n), 6);
const GAS_TOPUP = ethers.parseEther("0.02"); // enough for ~10 txs on Amoy

function polygonscanTx(network: string, hash: string): string {
  if (network === "polygonAmoy") return `https://amoy.polygonscan.com/tx/${hash}`;
  if (network === "polygon") return `https://polygonscan.com/tx/${hash}`;
  return hash;
}
function polygonscanAddress(network: string, addr: string): string {
  if (network === "polygonAmoy") return `https://amoy.polygonscan.com/address/${addr}`;
  if (network === "polygon") return `https://polygonscan.com/address/${addr}`;
  return addr;
}

async function sendAndPrint(label: string, txPromise: Promise<any>): Promise<string> {
  const tx = await txPromise;
  const receipt = await tx.wait();
  const hash = receipt?.hash ?? tx.hash;
  console.log(`    ${label.padEnd(36)} ${polygonscanTx(network.name, hash)}`);
  return hash;
}

async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment file at ${deploymentPath}. Run \`npm run deploy:${network.name}\` first.`);
  }
  const dep: Deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const [deployer] = await ethers.getSigners();

  console.log(`\n=== Testnet smoke on ${network.name} ===`);
  console.log(`Deployer:       ${deployer.address}`);
  console.log(`Factory:        ${polygonscanAddress(network.name, dep.contracts.factory)}`);
  console.log(`Implementation: ${polygonscanAddress(network.name, dep.contracts.implementation)}`);
  console.log(`Treasury:       ${polygonscanAddress(network.name, dep.contracts.treasury)}`);
  console.log(`Registry:       ${polygonscanAddress(network.name, dep.contracts.registry)}`);
  console.log(`Token (mock):   ${polygonscanAddress(network.name, dep.contracts.token)}`);

  // Generate three throwaway actors and fund them with POL for gas.
  const buyer = ethers.Wallet.createRandom().connect(ethers.provider);
  const seller = ethers.Wallet.createRandom().connect(ethers.provider);
  const arbitrator = ethers.Wallet.createRandom().connect(ethers.provider);
  console.log(`\nActors:`);
  console.log(`  buyer:      ${buyer.address}`);
  console.log(`  seller:     ${seller.address}`);
  console.log(`  arbitrator: ${arbitrator.address}`);

  console.log(`\n--- Fund actors with POL for gas ---`);
  for (const [name, w] of Object.entries({ buyer, seller, arbitrator })) {
    await sendAndPrint(`topup POL → ${name}`, deployer.sendTransaction({ to: w.address, value: GAS_TOPUP }));
  }

  // Contract handles
  const factory = await ethers.getContractAt("EscrowFactory", dep.contracts.factory, deployer);
  const treasury = await ethers.getContractAt("PlatformTreasury", dep.contracts.treasury, deployer);
  const registry = await ethers.getContractAt("ArbitratorRegistry", dep.contracts.registry, deployer);
  const token = await ethers.getContractAt("MockERC20", dep.contracts.token, deployer);

  // Pre-mint tokens
  const amount = USDT(10); // 10 USDT deal
  const buyerMint = USDT(100);
  const arbMint = USDT(300); // more than minStake (200) so depositStake works
  console.log(`\n--- Mint MockERC20 ---`);
  await sendAndPrint(`mint 100 USDT → buyer`, token.mint(buyer.address, buyerMint));
  await sendAndPrint(`mint 300 USDT → arb`, token.mint(arbitrator.address, arbMint));

  console.log(`\n--- Register + stake arbitrator ---`);
  // hire (admin) — Level.JUNIOR = 1 (TRAINEE=0, JUNIOR=1, SENIOR=2, HEAD=3)
  await sendAndPrint(`Registry.hire(arb, JUNIOR)`, registry.hire(arbitrator.address, 1));
  const minStake = await registry.minStake();
  await sendAndPrint(`arb.approve(Registry, minStake)`, token.connect(arbitrator).approve(dep.contracts.registry, minStake));
  await sendAndPrint(`arb.depositStake(minStake)`, registry.connect(arbitrator).depositStake(minStake));
  const eligible = await registry.isEligible(arbitrator.address);
  console.log(`    Registry.isEligible(arb) = ${eligible}`);
  if (!eligible) throw new Error("Arbitrator not eligible after stake");

  // =============================================================
  // HAPPY PATH — createEscrow → fund → release
  // =============================================================
  console.log(`\n\n=== HAPPY PATH ===`);
  const happyDealId = ethers.keccak256(ethers.toUtf8Bytes(`happy-${Date.now()}`));
  console.log(`DealId: ${happyDealId}`);

  const expectedClone = await factory.predictEscrowAddress(happyDealId);
  console.log(`Predicted escrow clone: ${polygonscanAddress(network.name, expectedClone)}`);

  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1h
  const feeModel = 0; // BUYER_PAYS
  await sendAndPrint(
    `Factory.createEscrow`,
    factory.createEscrow(happyDealId, buyer.address, seller.address, amount, feeModel, deadline),
  );

  const cloneAddress = await factory.escrowOf(happyDealId);
  console.log(`Actual escrow clone:    ${polygonscanAddress(network.name, cloneAddress)}`);
  if (cloneAddress.toLowerCase() !== expectedClone.toLowerCase()) {
    throw new Error("Predicted clone mismatch");
  }

  const clone = await ethers.getContractAt("EscrowImplementation", cloneAddress, deployer);
  const buyerFee = await clone.buyerFee();
  const sellerFee = await clone.sellerFee();
  const fundAmount = amount + buyerFee;
  console.log(`    amount=${amount}, buyerFee=${buyerFee}, sellerFee=${sellerFee}, fund=${fundAmount}`);

  await sendAndPrint(`buyer transfers USDT → clone`, token.connect(buyer).transfer(cloneAddress, fundAmount));
  await sendAndPrint(`clone.notifyFunded (relay)`, clone.notifyFunded());

  const sellerBalBefore = await token.balanceOf(seller.address);
  const treasuryBalBefore = await token.balanceOf(dep.contracts.treasury);
  await sendAndPrint(`clone.release (buyer)`, clone.connect(buyer).release());
  const sellerBalAfter = await token.balanceOf(seller.address);
  const treasuryBalAfter = await token.balanceOf(dep.contracts.treasury);

  const sellerPayout = sellerBalAfter - sellerBalBefore;
  const treasuryGain = treasuryBalAfter - treasuryBalBefore;
  console.log(`    seller received:   ${ethers.formatUnits(sellerPayout, 6)} USDT (expected ${ethers.formatUnits(amount - sellerFee, 6)})`);
  console.log(`    treasury received: ${ethers.formatUnits(treasuryGain, 6)} USDT (expected ${ethers.formatUnits(buyerFee + sellerFee, 6)})`);
  if (sellerPayout !== amount - sellerFee) throw new Error("Happy path: seller payout mismatch");
  if (treasuryGain !== buyerFee + sellerFee) throw new Error("Happy path: treasury gain mismatch");

  const statusHappy = await clone.status();
  console.log(`    clone.status = ${statusHappy} (expected 3 = RELEASED)`);

  // =============================================================
  // DISPUTE PATH — createEscrow → fund → dispute → assign → resolve(0, 100)
  // (buyer fully guilty; fine paid entirely from escrow so Treasury Reserve
  //  doesn't need pre-funding for the smoke run. The 70/30 split — which
  //  pulls part of the fine from Reserve — is exercised in a separate run
  //  after enough happy-path fees have accumulated.)
  // =============================================================
  console.log(`\n\n=== DISPUTE PATH ===`);
  const disputeDealId = ethers.keccak256(ethers.toUtf8Bytes(`dispute-${Date.now()}`));
  console.log(`DealId: ${disputeDealId}`);

  await sendAndPrint(
    `Factory.createEscrow`,
    factory.createEscrow(disputeDealId, buyer.address, seller.address, amount, feeModel, deadline),
  );
  const disputeClone = await factory.escrowOf(disputeDealId);
  const dclone = await ethers.getContractAt("EscrowImplementation", disputeClone, deployer);

  const dBuyerFee = await dclone.buyerFee();
  const fund2 = amount + dBuyerFee;
  await sendAndPrint(`buyer transfers USDT → clone`, token.connect(buyer).transfer(disputeClone, fund2));
  await sendAndPrint(`clone.notifyFunded (relay)`, dclone.notifyFunded());

  await sendAndPrint(`clone.dispute (buyer)`, dclone.connect(buyer).dispute());
  await sendAndPrint(`clone.assignArbitrator (relay)`, dclone.assignArbitrator(arbitrator.address));

  const buyerBalBefore = await token.balanceOf(buyer.address);
  const sellerBalBefore2 = await token.balanceOf(seller.address);
  const arbBalBefore = await token.balanceOf(arbitrator.address);
  const treasuryBalBefore2 = await token.balanceOf(dep.contracts.treasury);
  await sendAndPrint(`clone.resolve(0, 100) (arbitrator)`, dclone.connect(arbitrator).resolve(0, 100));
  const buyerBalAfter = await token.balanceOf(buyer.address);
  const sellerBalAfter2 = await token.balanceOf(seller.address);
  const arbBalAfter = await token.balanceOf(arbitrator.address);
  const treasuryBalAfter2 = await token.balanceOf(dep.contracts.treasury);

  console.log(`    buyer delta:    ${ethers.formatUnits(buyerBalAfter - buyerBalBefore, 6)} USDT`);
  console.log(`    seller delta:   ${ethers.formatUnits(sellerBalAfter2 - sellerBalBefore2, 6)} USDT`);
  console.log(`    arbitrator delta: ${ethers.formatUnits(arbBalAfter - arbBalBefore, 6)} USDT`);
  console.log(`    treasury delta: ${ethers.formatUnits(treasuryBalAfter2 - treasuryBalBefore2, 6)} USDT`);

  const statusDispute = await dclone.status();
  console.log(`    clone.status = ${statusDispute} (expected 6 = RESOLVED)`);

  console.log(`\n\n=== Smoke test complete. ===`);
  console.log(`All contract addresses and tx hashes above are real on ${network.name}.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
