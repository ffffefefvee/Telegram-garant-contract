import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";

// Smoke tests for the existing Escrow.sol. They lock in current behavior so any
// upcoming refactor (factory + clones + reentrancy guard + party-restricted
// release/refund — see docs/PRODUCT_PLAN.md §4) must not silently regress these
// invariants. Tests use a fake "factory" EOA because EscrowFactory.sol does not
// yet exist in the repo.

describe("Escrow (current implementation)", () => {
  const DEAL_ID = ethers.encodeBytes32String("deal-1");
  const AMOUNT = ethers.parseUnits("100", 6); // 100 USDT (6 decimals)

  let factory: Signer;
  let buyer: Signer;
  let seller: Signer;
  let arbitrator: Signer;
  let stranger: Signer;
  let usdt: any;
  let escrow: any;

  beforeEach(async () => {
    [factory, buyer, seller, arbitrator, stranger] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockERC20");
    usdt = await Mock.deploy("Tether USD", "USDT", 6);
    await usdt.waitForDeployment();

    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.connect(factory).deploy(
      await factory.getAddress(),
      await buyer.getAddress(),
      await seller.getAddress(),
      await arbitrator.getAddress(),
      await usdt.getAddress(),
      DEAL_ID,
    );
    await escrow.waitForDeployment();

    // Pre-fund the escrow contract with tokens (in production this is done by
    // the platform relay wallet after Cryptomus webhook).
    await usdt.mint(await escrow.getAddress(), AMOUNT);
  });

  describe("deployment", () => {
    it("stores constructor params as immutable getters", async () => {
      expect(await escrow.factory()).to.equal(await factory.getAddress());
      expect(await escrow.buyer()).to.equal(await buyer.getAddress());
      expect(await escrow.seller()).to.equal(await seller.getAddress());
      expect(await escrow.arbitrator()).to.equal(await arbitrator.getAddress());
      expect(await escrow.token()).to.equal(await usdt.getAddress());
      expect(await escrow.dealId()).to.equal(DEAL_ID);
    });

    it("starts in CREATED status with zero amount", async () => {
      expect(await escrow.status()).to.equal(0); // Status.CREATED
      expect(await escrow.amount()).to.equal(0);
    });
  });

  describe("fund", () => {
    it("can only be called by factory", async () => {
      await expect(
        escrow.connect(stranger).fund(AMOUNT),
      ).to.be.revertedWith("Only factory");
    });

    it("transitions to FUNDED and splits amount into 5% buyerFee + 95% sellerFee", async () => {
      await expect(escrow.connect(factory).fund(AMOUNT))
        .to.emit(escrow, "Funded")
        .withArgs(AMOUNT);

      expect(await escrow.status()).to.equal(1); // Status.FUNDED
      expect(await escrow.amount()).to.equal(AMOUNT);
      expect(await escrow.buyerFee()).to.equal((AMOUNT * 500n) / 10000n);
      expect(await escrow.sellerFee()).to.equal(AMOUNT - (AMOUNT * 500n) / 10000n);
    });

    it("rejects double funding", async () => {
      await escrow.connect(factory).fund(AMOUNT);
      await expect(
        escrow.connect(factory).fund(AMOUNT),
      ).to.be.revertedWith("Already funded or closed");
    });

    it("rejects zero amount", async () => {
      await expect(
        escrow.connect(factory).fund(0n),
      ).to.be.revertedWith("Amount must be > 0");
    });
  });

  describe("release", () => {
    beforeEach(async () => {
      await escrow.connect(factory).fund(AMOUNT);
    });

    it("transfers sellerFee to seller and transitions to RELEASED", async () => {
      const sellerFee = await escrow.sellerFee();
      const before = await usdt.balanceOf(await seller.getAddress());

      await expect(escrow.connect(buyer).release())
        .to.emit(escrow, "Released")
        .withArgs(await seller.getAddress(), sellerFee);

      const after = await usdt.balanceOf(await seller.getAddress());
      expect(after - before).to.equal(sellerFee);
      expect(await escrow.status()).to.equal(2); // Status.RELEASED
    });

    it("rejects callers that are not buyer/seller/arbitrator", async () => {
      await expect(
        escrow.connect(stranger).release(),
      ).to.be.revertedWith("Only parties");
    });

    it("cannot release after release", async () => {
      await escrow.connect(buyer).release();
      await expect(
        escrow.connect(buyer).release(),
      ).to.be.revertedWith("Not funded or already closed");
    });
  });

  describe("refund", () => {
    beforeEach(async () => {
      await escrow.connect(factory).fund(AMOUNT);
    });

    it("returns full amount to buyer and transitions to REFUNDED", async () => {
      const before = await usdt.balanceOf(await buyer.getAddress());

      await expect(escrow.connect(seller).refund())
        .to.emit(escrow, "Refunded")
        .withArgs(await buyer.getAddress(), AMOUNT);

      const after = await usdt.balanceOf(await buyer.getAddress());
      expect(after - before).to.equal(AMOUNT);
      expect(await escrow.status()).to.equal(3); // Status.REFUNDED
    });

    it("rejects callers that are not buyer/seller/arbitrator", async () => {
      await expect(
        escrow.connect(stranger).refund(),
      ).to.be.revertedWith("Only parties");
    });
  });

  describe("dispute and resolve", () => {
    beforeEach(async () => {
      await escrow.connect(factory).fund(AMOUNT);
    });

    it("dispute() flips status to DISPUTED", async () => {
      await expect(escrow.connect(buyer).dispute()).to.emit(escrow, "Disputed");
      expect(await escrow.status()).to.equal(4); // Status.DISPUTED
    });

    it("resolve(70) sends 70% to buyer and 30% to seller", async () => {
      await escrow.connect(buyer).dispute();

      const buyerBefore = await usdt.balanceOf(await buyer.getAddress());
      const sellerBefore = await usdt.balanceOf(await seller.getAddress());

      await escrow.connect(arbitrator).resolve(70);

      const buyerShare = (AMOUNT * 70n) / 100n;
      const sellerShare = AMOUNT - buyerShare;

      expect(
        (await usdt.balanceOf(await buyer.getAddress())) - buyerBefore,
      ).to.equal(buyerShare);
      expect(
        (await usdt.balanceOf(await seller.getAddress())) - sellerBefore,
      ).to.equal(sellerShare);
      expect(await escrow.status()).to.equal(5); // Status.RESOLVED
    });

    it("resolve() can only be called by arbitrator", async () => {
      await escrow.connect(buyer).dispute();
      await expect(
        escrow.connect(buyer).resolve(50),
      ).to.be.revertedWith("Only arbitrator");
    });

    it("resolve() rejects percent > 100", async () => {
      await escrow.connect(buyer).dispute();
      await expect(
        escrow.connect(arbitrator).resolve(101),
      ).to.be.revertedWith("Invalid percent");
    });
  });

  describe("getBalance", () => {
    it("returns the contract's USDT balance", async () => {
      expect(await escrow.getBalance()).to.equal(AMOUNT);
    });
  });
});
