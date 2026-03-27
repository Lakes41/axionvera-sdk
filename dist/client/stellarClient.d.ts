import { Account, FeeBumpTransaction, Keypair, rpc, Transaction } from "@stellar/stellar-sdk";
import { AxionveraNetwork } from "../utils/networkConfig";
import { RetryConfig } from "../utils/httpInterceptor";
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
export declare class StellarClient {
    readonly network: AxionveraNetwork;
    readonly rpcUrl: string;
    readonly networkPassphrase: string;
    readonly rpc: rpc.Server;
    readonly httpClient: import("axios").AxiosInstance;
    readonly retryConfig: Partial<RetryConfig>;
    constructor(options?: StellarClientOptions);
    getHealth(): Promise<unknown>;
    getNetwork(): Promise<unknown>;
    getLatestLedger(): Promise<unknown>;
    getAccount(publicKey: string): Promise<Account>;
    simulateTransaction(tx: Transaction | FeeBumpTransaction): Promise<rpc.Api.SimulateTransactionResponse>;
    prepareTransaction(tx: Transaction | FeeBumpTransaction): Promise<Transaction>;
    sendTransaction(tx: Transaction | FeeBumpTransaction): Promise<TransactionSendResult>;
    getTransaction(hash: string): Promise<unknown>;
    pollTransaction(hash: string, params?: {
        timeoutMs?: number;
        intervalMs?: number;
    }): Promise<unknown>;
    signWithKeypair(tx: Transaction, keypair: Keypair): Promise<Transaction>;
    static parseTransactionXdr(transactionXdr: string, networkPassphrase: string): Transaction | FeeBumpTransaction;
    static getDefaultNetworkPassphrase(network: AxionveraNetwork): string;
}
//# sourceMappingURL=stellarClient.d.ts.map