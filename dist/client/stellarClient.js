"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StellarClient = void 0;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const networkConfig_1 = require("../utils/networkConfig");
const httpInterceptor_1 = require("../utils/httpInterceptor");
class StellarClient {
    constructor(options) {
        const config = (0, networkConfig_1.resolveNetworkConfig)(options);
        this.network = config.network;
        this.rpcUrl = config.rpcUrl;
        this.networkPassphrase = config.networkPassphrase;
        this.retryConfig = options?.retryConfig ?? {};
        this.httpClient = (0, httpInterceptor_1.createHttpClientWithRetry)(this.retryConfig);
        if (options?.rpcClient) {
            this.rpc = options.rpcClient;
        }
        else {
            const allowHttp = this.rpcUrl.startsWith("http://");
            this.rpc = new stellar_sdk_1.rpc.Server(this.rpcUrl, { allowHttp });
        }
    }
    async getHealth() {
        return (0, httpInterceptor_1.retry)(() => this.rpc.getHealth(), this.retryConfig);
    }
    async getNetwork() {
        return (0, httpInterceptor_1.retry)(() => this.rpc.getNetwork(), this.retryConfig);
    }
    async getLatestLedger() {
        return (0, httpInterceptor_1.retry)(() => this.rpc.getLatestLedger(), this.retryConfig);
    }
    async getAccount(publicKey) {
        return (0, httpInterceptor_1.retry)(() => this.rpc.getAccount(publicKey), this.retryConfig);
    }
    async simulateTransaction(tx) {
        return this.rpc.simulateTransaction(tx);
    }
    async prepareTransaction(tx) {
        return this.rpc.prepareTransaction(tx);
    }
    async sendTransaction(tx) {
        const result = await this.rpc.sendTransaction(tx);
        const hash = result.hash ?? result.id ?? "";
        const status = result.status ?? result.statusText ?? "unknown";
        return { hash, status, raw: result };
    }
    async getTransaction(hash) {
        return (0, httpInterceptor_1.retry)(() => this.rpc.getTransaction(hash), this.retryConfig);
    }
    async pollTransaction(hash, params) {
        const timeoutMs = params?.timeoutMs ?? 30000;
        const intervalMs = params?.intervalMs ?? 1000;
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const res = await this.getTransaction(hash);
            const status = res?.status;
            if (status && status !== "NOT_FOUND") {
                return res;
            }
            await new Promise((r) => setTimeout(r, intervalMs));
        }
        throw new Error(`Timed out waiting for transaction ${hash}`);
    }
    async signWithKeypair(tx, keypair) {
        tx.sign(keypair);
        return tx;
    }
    static parseTransactionXdr(transactionXdr, networkPassphrase) {
        return stellar_sdk_1.TransactionBuilder.fromXDR(transactionXdr, networkPassphrase);
    }
    static getDefaultNetworkPassphrase(network) {
        switch (network) {
            case "testnet":
                return stellar_sdk_1.Networks.TESTNET;
            case "mainnet":
                return stellar_sdk_1.Networks.PUBLIC;
        }
    }
}
exports.StellarClient = StellarClient;
