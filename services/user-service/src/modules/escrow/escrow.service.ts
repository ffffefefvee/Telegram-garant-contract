import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

export interface EscrowCreationResult {
  dealId: string;
  escrowAddress: string;
  transactionHash: string;
}

export interface EscrowInfo {
  address: string;
  status: 'created' | 'funded' | 'released' | 'refunded' | 'disputed' | 'resolved';
  buyer: string;
  seller: string;
  arbitrator: string;
  amount: number;
}

@Injectable()
export class EscrowService implements OnModuleInit {
  private readonly logger = new Logger(EscrowService.name);
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private factoryContract: ethers.Contract | null = null;
  private factoryAddress: string;
  private tokenAddress: string;
  private isBlockchainEnabled: boolean = false;

  private abi = [
    "function createEscrow(bytes32 dealId, address buyer, address seller, address arbitrator, address token, uint256 amount) external returns (address)",
    "function getEscrow(bytes32 dealId) external view returns (address)",
    "function escrowExists(bytes32 dealId) external view returns (bool)",
    "function getEscrowInfo(bytes32 dealId) external view returns (address escrow, address buyer, address seller, address arbitrator, uint256 amount, uint8 status)",
    "function updatePlatformFee(uint256 newFeePercent) external",
    "function platformFeePercent() external view returns (uint256)",
    "function platformWallet() external view returns (address)",
    "event EscrowCreated(address indexed escrow, bytes32 indexed dealId, address buyer, address seller, address arbitrator, address token)"
  ];

  constructor(private configService: ConfigService) {
    this.factoryAddress = this.configService.get('ESCROW_FACTORY_ADDRESS', '');
    this.tokenAddress = this.configService.get('USDT_CONTRACT_ADDRESS', '');
  }

  async onModuleInit() {
    if (!this.factoryAddress || this.factoryAddress === '') {
      this.logger.warn('ESCROW_FACTORY_ADDRESS not set. Escrow service running in DATABASE MODE.');
      this.isBlockchainEnabled = false;
      return;
    }

    const rpcUrl = this.configService.get('BLOCKCHAIN_RPC_URL', 'https://polygon-amoy.infura.io/v3/your_key');
    const privateKey = this.configService.get('BLOCKCHAIN_PRIVATE_KEY', '');

    if (!rpcUrl || !privateKey) {
      this.logger.warn('Blockchain credentials not set. Escrow service running in DATABASE MODE.');
      this.isBlockchainEnabled = false;
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.factoryContract = new ethers.Contract(this.factoryAddress, this.abi, this.wallet);
      this.isBlockchainEnabled = true;
      this.logger.log(`Escrow Service initialized. Factory: ${this.factoryAddress}`);
    } catch (error) {
      this.logger.error('Failed to initialize blockchain connection. Running in DATABASE MODE.', error);
      this.isBlockchainEnabled = false;
    }
  }

  /**
   * Создать escrow для сделки
   * В DATABASE MODE - просто возвращает виртуальный адрес
   */
  async createEscrow(
    dealId: string,
    buyer: string,
    seller: string,
    arbitrator: string,
    amount: number,
  ): Promise<EscrowCreationResult> {
    if (!this.isBlockchainEnabled || !this.factoryContract) {
      const virtualAddress = ethers.Wallet.createRandom().address;
      this.logger.log(`[DB MODE] Virtual escrow for deal ${dealId}: ${virtualAddress}`);
      return {
        dealId,
        escrowAddress: virtualAddress,
        transactionHash: '0x' + '0'.repeat(64),
      };
    }

    this.logger.log(`Creating escrow for deal ${dealId}...`);

    const dealIdBytes32 = ethers.isBytesLike(dealId) ? dealId : ethers.keccak256(ethers.toUtf8Bytes(dealId));
    const amountWei = ethers.parseUnits(amount.toString(), 6);

    const tx = await this.factoryContract.createEscrow(
      dealIdBytes32,
      buyer,
      seller,
      arbitrator || ethers.ZeroAddress,
      this.tokenAddress,
      amountWei,
    );

    this.logger.log(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();

    const escrowAddress = await this.factoryContract.getEscrow(dealIdBytes32);
    this.logger.log(`Escrow created for deal ${dealId} at ${escrowAddress}`);

    return {
      dealId,
      escrowAddress,
      transactionHash: receipt.hash,
    };
  }

  /**
   * Получить адрес escrow
   */
  async getEscrowAddress(dealId: string): Promise<string> {
    if (!this.isBlockchainEnabled) {
      return '0x' + '0'.repeat(40);
    }

    const dealIdBytes32 = ethers.isBytesLike(dealId) ? dealId : ethers.keccak256(ethers.toUtf8Bytes(dealId));
    return this.factoryContract!.getEscrow(dealIdBytes32);
  }

  /**
   * Проверить существование escrow
   */
  async escrowExists(dealId: string): Promise<boolean> {
    if (!this.isBlockchainEnabled) {
      return true;
    }

    const dealIdBytes32 = ethers.isBytesLike(dealId) ? dealId : ethers.keccak256(ethers.toUtf8Bytes(dealId));
    return this.factoryContract!.escrowExists(dealIdBytes32);
  }

  /**
   * Освободить средства продавцу
   */
  async releaseFunds(dealId: string): Promise<string> {
    if (!this.isBlockchainEnabled) {
      this.logger.log(`[DB MODE] Release funds for deal ${dealId}`);
      return '0x' + '0'.repeat(64);
    }

    const escrowAddress = await this.getEscrowAddress(dealId);
    if (escrowAddress === ethers.ZeroAddress) {
      throw new Error('Escrow not found');
    }

    const escrowAbi = [
      "function release() external",
      "function status() external view returns (uint8)"
    ];
    const escrow = new ethers.Contract(escrowAddress, escrowAbi, this.wallet!);

    const tx = await escrow.release();
    const receipt = await tx.wait();

    this.logger.log(`Funds released for deal ${dealId}. TX: ${receipt.hash}`);
    return receipt.hash;
  }

  /**
   * Вернуть средства покупателю
   */
  async refundFunds(dealId: string): Promise<string> {
    if (!this.isBlockchainEnabled) {
      this.logger.log(`[DB MODE] Refund funds for deal ${dealId}`);
      return '0x' + '0'.repeat(64);
    }

    const escrowAddress = await this.getEscrowAddress(dealId);
    if (escrowAddress === ethers.ZeroAddress) {
      throw new Error('Escrow not found');
    }

    const escrowAbi = ["function refund() external"];
    const escrow = new ethers.Contract(escrowAddress, escrowAbi, this.wallet!);

    const tx = await escrow.refund();
    const receipt = await tx.wait();

    this.logger.log(`Funds refunded for deal ${dealId}. TX: ${receipt.hash}`);
    return receipt.hash;
  }

  /**
   * Открыть спор
   */
  async openDispute(dealId: string): Promise<string> {
    if (!this.isBlockchainEnabled) {
      this.logger.log(`[DB MODE] Dispute opened for deal ${dealId}`);
      return '0x' + '0'.repeat(64);
    }

    const escrowAddress = await this.getEscrowAddress(dealId);
    if (escrowAddress === ethers.ZeroAddress) {
      throw new Error('Escrow not found');
    }

    const escrowAbi = ["function dispute() external"];
    const escrow = new ethers.Contract(escrowAddress, escrowAbi, this.wallet!);

    const tx = await escrow.dispute();
    const receipt = await tx.wait();

    this.logger.log(`Dispute opened for deal ${dealId}. TX: ${receipt.hash}`);
    return receipt.hash;
  }

  /**
   * Разрешить спор (только для арбитра)
   */
  async resolveDispute(dealId: string, buyerPercent: number): Promise<string> {
    if (!this.isBlockchainEnabled) {
      this.logger.log(`[DB MODE] Dispute resolved for deal ${dealId} (buyer: ${buyerPercent}%)`);
      return '0x' + '0'.repeat(64);
    }

    const escrowAddress = await this.getEscrowAddress(dealId);
    if (escrowAddress === ethers.ZeroAddress) {
      throw new Error('Escrow not found');
    }

    const escrowAbi = ["function resolve(uint256 buyerPercent) external"];
    const escrow = new ethers.Contract(escrowAddress, escrowAbi, this.wallet!);

    const tx = await escrow.resolve(buyerPercent);
    const receipt = await tx.wait();

    this.logger.log(`Dispute resolved for deal ${dealId}. TX: ${receipt.hash}`);
    return receipt.hash;
  }

  /**
   * Получить информацию об escrow
   */
  async getEscrowInfo(dealId: string): Promise<EscrowInfo | null> {
    if (!this.isBlockchainEnabled) {
      return {
        address: '0x' + '0'.repeat(40),
        status: 'funded',
        buyer: '0x' + '0'.repeat(40),
        seller: '0x' + '0'.repeat(40),
        arbitrator: '0x' + '0'.repeat(40),
        amount: 0,
      };
    }

    const dealIdBytes32 = ethers.isBytesLike(dealId) ? dealId : ethers.keccak256(ethers.toUtf8Bytes(dealId));
    const [escrow, buyer, seller, arbitrator, amount, status] = await this.factoryContract!.getEscrowInfo(dealIdBytes32);

    if (escrow === ethers.ZeroAddress) {
      return null;
    }

    const statusMap: Record<number, EscrowInfo['status']> = {
      0: 'created',
      1: 'funded',
      2: 'released',
      3: 'refunded',
      4: 'disputed',
      5: 'resolved',
    };

    return {
      address: escrow,
      status: statusMap[status] || 'created',
      buyer,
      seller,
      arbitrator,
      amount: parseFloat(ethers.formatUnits(amount, 6)),
    };
  }

  /**
   * Проверить, включен ли блокчейн режим
   */
  isEnabled(): boolean {
    return this.isBlockchainEnabled;
  }
}