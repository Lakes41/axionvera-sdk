import * as axios from 'axios';
import { AxiosInstance } from 'axios';
import { rpc, Account, Transaction, FeeBumpTransaction, Keypair, xdr, Address } from '@stellar/stellar-sdk';

type AxionveraNetwork = "testnet" | "mainnet";
type NetworkConfig = {
    network: AxionveraNetwork;
    rpcUrl: string;
    networkPassphrase: string;
};
declare function getNetworkPassphrase(network: AxionveraNetwork): string;
declare function getDefaultRpcUrl(network: AxionveraNetwork): string;
declare function resolveNetworkConfig(input?: {
    network?: AxionveraNetwork;
    rpcUrl?: string;
    networkPassphrase?: string;
}): NetworkConfig;

type RetryConfig = {
    enabled: boolean;
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    retryableMethods: string[];
    retryableStatusCodes: number[];
};
declare function createHttpClientWithRetry(retryConfig?: Partial<RetryConfig>): AxiosInstance;
declare function retry<T>(fn: () => Promise<T>, retryConfig?: Partial<RetryConfig>): Promise<T>;

type StellarClientOptions = {
    network?: AxionveraNetwork;
    rpcUrl?: string;
    networkPassphrase?: string;
    rpcClient?: rpc.Server;
    retryConfig?: Partial<RetryConfig>;
};
type TransactionSendResult = {
    hash: string;
    status: string;
    raw: unknown;
};
declare class StellarClient {
    readonly network: AxionveraNetwork;
    readonly rpcUrl: string;
    readonly networkPassphrase: string;
    readonly rpc: rpc.Server;
    readonly httpClient: axios.AxiosInstance;
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

interface WalletConnector {
    getPublicKey(): Promise<string>;
    signTransaction(transactionXdr: string, networkPassphrase: string): Promise<string>;
}
declare class LocalKeypairWalletConnector implements WalletConnector {
    private readonly keypair;
    constructor(keypair: Keypair);
    getPublicKey(): Promise<string>;
    signTransaction(transactionXdr: string, networkPassphrase: string): Promise<string>;
}

type VaultContractMethodNames = {
    deposit: string;
    withdraw: string;
    balance: string;
    claimRewards: string;
};
type VaultContractOptions = {
    methods?: Partial<VaultContractMethodNames>;
};
declare class VaultContract {
    readonly contractId: string;
    private readonly client;
    private readonly wallet?;
    private readonly methods;
    constructor(params: {
        client: StellarClient;
        contractId: string;
        wallet?: WalletConnector;
        options?: VaultContractOptions;
    });
    deposit(params: {
        amount: bigint;
        from?: string;
    }): Promise<unknown>;
    withdraw(params: {
        amount: bigint;
        from?: string;
    }): Promise<unknown>;
    claimRewards(params?: {
        from?: string;
    }): Promise<unknown>;
    getBalance(params: {
        account?: string;
    }): Promise<unknown>;
    private getSourcePublicKey;
    private sendContractCall;
}

type ContractCallArg = xdr.ScVal | Address | string | number | bigint | boolean | null;
type BuildContractCallParams = {
    sourceAccount: Account;
    networkPassphrase: string;
    contractId: string;
    method: string;
    args?: ContractCallArg[];
    fee?: number;
    timeoutInSeconds?: number;
};
declare function toScVal(arg: ContractCallArg): xdr.ScVal;
declare function buildContractCallOperation(params: {
    contractId: string;
    method: string;
    args?: ContractCallArg[];
}): xdr.Operation;
declare function buildContractCallTransaction(params: BuildContractCallParams): Transaction;

export { type AxionveraNetwork, type BuildContractCallParams, type ContractCallArg, LocalKeypairWalletConnector, type NetworkConfig, type RetryConfig, StellarClient, VaultContract, type WalletConnector, buildContractCallOperation, buildContractCallTransaction, createHttpClientWithRetry, getDefaultRpcUrl, getNetworkPassphrase, resolveNetworkConfig, retry, toScVal };
