import {
  Account,
  FeeBumpTransaction,
  Keypair,
  Networks,
  rpc,
  Transaction,
  TransactionBuilder
} from "@stellar/stellar-sdk";

import { AxionveraNetwork, resolveNetworkConfig } from "../utils/networkConfig";
import { RetryConfig, createHttpClientWithRetry, retry } from "../utils/httpInterceptor";

export type StellarClientOptions = {
  network?: AxionveraNetwork;
  rpcUrl?: string;
  networkPassphrase?: string;
  rpcClient?: rpc.Server;
  retryConfig?: Partial<RetryConfig>;
};

export type TransactionSendResult = {
  hash: string;
  status: string;
  raw: unknown;
};

export class StellarClient {
  readonly network: AxionveraNetwork;
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
  readonly rpc: rpc.Server;
  readonly httpClient;
  readonly retryConfig: Partial<RetryConfig>;

  constructor(options?: StellarClientOptions) {
    const config = resolveNetworkConfig(options);
    this.network = config.network;
    this.rpcUrl = config.rpcUrl;
    this.networkPassphrase = config.networkPassphrase;
    this.retryConfig = options?.retryConfig ?? {};
    this.httpClient = createHttpClientWithRetry(this.retryConfig);

    if (options?.rpcClient) {
      this.rpc = options.rpcClient;
    } else {
      const allowHttp = this.rpcUrl.startsWith("http://");
      this.rpc = new rpc.Server(this.rpcUrl, { allowHttp });
    }
  }

  async getHealth(): Promise<unknown> {
    return retry(() => this.rpc.getHealth(), this.retryConfig);
  }

  async getNetwork(): Promise<unknown> {
    return retry(() => this.rpc.getNetwork(), this.retryConfig);
  }

  async getLatestLedger(): Promise<unknown> {
    return retry(() => this.rpc.getLatestLedger(), this.retryConfig);
  }

  async getAccount(publicKey: string): Promise<Account> {
    return retry(() => this.rpc.getAccount(publicKey), this.retryConfig);
  }

  async simulateTransaction(
    tx: Transaction | FeeBumpTransaction
  ): Promise<rpc.Api.SimulateTransactionResponse> {
    return this.rpc.simulateTransaction(tx);
  }

  async prepareTransaction(tx: Transaction | FeeBumpTransaction): Promise<Transaction> {
    return this.rpc.prepareTransaction(tx);
  }

  async sendTransaction(tx: Transaction | FeeBumpTransaction): Promise<TransactionSendResult> {
    const result = await this.rpc.sendTransaction(tx);
    const hash = (result as any).hash ?? (result as any).id ?? "";
    const status = (result as any).status ?? (result as any).statusText ?? "unknown";
    return { hash, status, raw: result };
  }

  async getTransaction(hash: string): Promise<unknown> {
    return retry(() => this.rpc.getTransaction(hash), this.retryConfig);
  }

  async pollTransaction(
    hash: string,
    params?: { timeoutMs?: number; intervalMs?: number }
  ): Promise<unknown> {
    const timeoutMs = params?.timeoutMs ?? 30_000;
    const intervalMs = params?.intervalMs ?? 1_000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const res = await this.getTransaction(hash);
      const status = (res as any)?.status;
      if (status && status !== "NOT_FOUND") {
        return res;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error(`Timed out waiting for transaction ${hash}`);
  }

  async signWithKeypair(tx: Transaction, keypair: Keypair): Promise<Transaction> {
    tx.sign(keypair);
    return tx;
  }

  static parseTransactionXdr(
    transactionXdr: string,
    networkPassphrase: string
  ): Transaction | FeeBumpTransaction {
    return TransactionBuilder.fromXDR(transactionXdr, networkPassphrase);
  }

  static getDefaultNetworkPassphrase(network: AxionveraNetwork): string {
    switch (network) {
      case "testnet":
        return Networks.TESTNET;
      case "mainnet":
        return Networks.PUBLIC;
    }
  }
}
