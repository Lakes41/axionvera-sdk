// src/client/stellarClient.ts
import {
  Networks as Networks2,
  rpc,
  TransactionBuilder
} from "@stellar/stellar-sdk";

// src/utils/networkConfig.ts
import { Networks } from "@stellar/stellar-sdk";
var DEFAULT_RPC_URLS = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://soroban-mainnet.stellar.org"
};
function getNetworkPassphrase(network) {
  switch (network) {
    case "testnet":
      return Networks.TESTNET;
    case "mainnet":
      return Networks.PUBLIC;
  }
}
function getDefaultRpcUrl(network) {
  return DEFAULT_RPC_URLS[network];
}
function resolveNetworkConfig(input) {
  const network = input?.network ?? "testnet";
  const networkPassphrase = input?.networkPassphrase ?? getNetworkPassphrase(network);
  const rpcUrl = input?.rpcUrl ?? getDefaultRpcUrl(network);
  return { network, rpcUrl, networkPassphrase };
}

// src/utils/httpInterceptor.ts
import axios from "axios";
var DEFAULT_RETRY_CONFIG = {
  enabled: true,
  maxRetries: 3,
  baseDelayMs: 1e3,
  maxDelayMs: 8e3,
  retryableMethods: ["GET", "PUT"],
  retryableStatusCodes: [429, 500, 502, 503, 504]
};
function calculateDelay(attemptNumber, baseDelayMs, maxDelayMs) {
  const delay2 = baseDelayMs * Math.pow(2, attemptNumber - 1);
  return Math.min(delay2, maxDelayMs);
}
function isRetryableRequest(config, retryConfig) {
  const method = config.method?.toUpperCase();
  return method ? retryConfig.retryableMethods.includes(method) : false;
}
function isRetryableError(error, retryConfig) {
  if (!error.response) {
    return false;
  }
  return retryConfig.retryableStatusCodes.includes(error.response.status);
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function createHttpClientWithRetry(retryConfig = {}) {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  const client = axios.create({
    timeout: 3e4
  });
  if (!config.enabled) {
    return client;
  }
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      if (!originalRequest || !isRetryableRequest(originalRequest, config) || !isRetryableError(error, config)) {
        return Promise.reject(error);
      }
      originalRequest._retryCount = originalRequest._retryCount || 0;
      if (originalRequest._retryCount >= config.maxRetries) {
        return Promise.reject(error);
      }
      originalRequest._retryCount++;
      const delayMs = calculateDelay(originalRequest._retryCount, config.baseDelayMs, config.maxDelayMs);
      await delay(delayMs);
      return client(originalRequest);
    }
  );
  return client;
}
async function retry(fn, retryConfig = {}) {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  if (!config.enabled) {
    return fn();
  }
  let lastError;
  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isRetryable = error.response && config.retryableStatusCodes.includes(error.response.status);
      if (!isRetryable || attempt > config.maxRetries) {
        throw error;
      }
      const delayMs = calculateDelay(attempt, config.baseDelayMs, config.maxDelayMs);
      await delay(delayMs);
    }
  }
  throw lastError;
}

// src/client/stellarClient.ts
var StellarClient = class {
  constructor(options) {
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
  async getHealth() {
    return retry(() => this.rpc.getHealth(), this.retryConfig);
  }
  async getNetwork() {
    return retry(() => this.rpc.getNetwork(), this.retryConfig);
  }
  async getLatestLedger() {
    return retry(() => this.rpc.getLatestLedger(), this.retryConfig);
  }
  async getAccount(publicKey) {
    return retry(() => this.rpc.getAccount(publicKey), this.retryConfig);
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
    return retry(() => this.rpc.getTransaction(hash), this.retryConfig);
  }
  async pollTransaction(hash, params) {
    const timeoutMs = params?.timeoutMs ?? 3e4;
    const intervalMs = params?.intervalMs ?? 1e3;
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
    return TransactionBuilder.fromXDR(transactionXdr, networkPassphrase);
  }
  static getDefaultNetworkPassphrase(network) {
    switch (network) {
      case "testnet":
        return Networks2.TESTNET;
      case "mainnet":
        return Networks2.PUBLIC;
    }
  }
};

// src/contracts/vault.ts
import {
  Address as Address2,
  TransactionBuilder as TransactionBuilder3,
  scValToNative
} from "@stellar/stellar-sdk";

// src/utils/transactionBuilder.ts
import {
  Address,
  Contract,
  TransactionBuilder as TransactionBuilder2,
  nativeToScVal,
  xdr
} from "@stellar/stellar-sdk";
function toScVal(arg) {
  if (arg === null) {
    return xdr.ScVal.scvVoid();
  }
  if (arg instanceof Address) {
    return arg.toScVal();
  }
  if (typeof arg === "string") {
    try {
      return Address.fromString(arg).toScVal();
    } catch {
      return nativeToScVal(arg);
    }
  }
  if (typeof arg === "number") {
    return nativeToScVal(arg);
  }
  if (typeof arg === "bigint") {
    return nativeToScVal(arg, { type: "i128" });
  }
  if (typeof arg === "boolean") {
    return nativeToScVal(arg);
  }
  return arg;
}
function buildContractCallOperation(params) {
  const contract = new Contract(params.contractId);
  const scVals = (params.args ?? []).map(toScVal);
  return contract.call(params.method, ...scVals);
}
function buildContractCallTransaction(params) {
  const operation = buildContractCallOperation({
    contractId: params.contractId,
    method: params.method,
    args: params.args
  });
  const fee = (params.fee ?? 1e5).toString();
  const timeoutInSeconds = params.timeoutInSeconds ?? 60;
  return new TransactionBuilder2(params.sourceAccount, {
    fee,
    networkPassphrase: params.networkPassphrase
  }).addOperation(operation).setTimeout(timeoutInSeconds).build();
}

// src/contracts/vault.ts
var VaultContract = class {
  constructor(params) {
    this.client = params.client;
    this.contractId = params.contractId;
    this.wallet = params.wallet;
    this.methods = {
      deposit: "deposit",
      withdraw: "withdraw",
      balance: "balance",
      claimRewards: "claim_rewards",
      ...params.options?.methods
    };
  }
  async deposit(params) {
    return this.sendContractCall({
      source: params.from,
      method: this.methods.deposit,
      args: [
        Address2.fromString(await this.getSourcePublicKey(params.from)).toScVal(),
        toScVal(params.amount)
      ]
    });
  }
  async withdraw(params) {
    return this.sendContractCall({
      source: params.from,
      method: this.methods.withdraw,
      args: [
        Address2.fromString(await this.getSourcePublicKey(params.from)).toScVal(),
        toScVal(params.amount)
      ]
    });
  }
  async claimRewards(params) {
    return this.sendContractCall({
      source: params?.from,
      method: this.methods.claimRewards,
      args: [Address2.fromString(await this.getSourcePublicKey(params?.from)).toScVal()]
    });
  }
  async getBalance(params) {
    const publicKey = params.account ?? (this.wallet ? await this.wallet.getPublicKey() : void 0);
    if (!publicKey) {
      throw new Error("account is required when no wallet connector is provided");
    }
    const sourceAccount = await this.client.getAccount(publicKey);
    const tx = buildContractCallTransaction({
      sourceAccount,
      networkPassphrase: this.client.networkPassphrase,
      contractId: this.contractId,
      method: this.methods.balance,
      args: [Address2.fromString(publicKey)]
    });
    const sim = await this.client.simulateTransaction(tx);
    if (!isSimSuccess(sim)) {
      throw new Error("Simulation failed");
    }
    const retval = sim.result?.retval;
    return retval ? scValToNative(retval) : null;
  }
  async getSourcePublicKey(source) {
    if (source) return source;
    if (!this.wallet) {
      throw new Error("wallet connector is required for signing transactions");
    }
    return this.wallet.getPublicKey();
  }
  async sendContractCall(params) {
    if (!this.wallet) {
      throw new Error("wallet connector is required for signing transactions");
    }
    const publicKey = await this.getSourcePublicKey(params.source);
    const sourceAccount = await this.client.getAccount(publicKey);
    const tx = buildContractCallTransaction({
      sourceAccount,
      networkPassphrase: this.client.networkPassphrase,
      contractId: this.contractId,
      method: params.method,
      args: params.args ?? []
    });
    const sim = await this.client.simulateTransaction(tx);
    if (!isSimSuccess(sim)) {
      throw new Error("Simulation failed");
    }
    const prepared = await this.client.prepareTransaction(tx);
    const signedXdr = await this.wallet.signTransaction(
      prepared.toXDR(),
      this.client.networkPassphrase
    );
    const signedTx = TransactionBuilder3.fromXDR(
      signedXdr,
      this.client.networkPassphrase
    );
    return this.client.sendTransaction(signedTx);
  }
};
function isSimSuccess(sim) {
  return Boolean(sim) && !sim.error && Boolean(sim.result);
}

// src/wallet/walletConnector.ts
import { TransactionBuilder as TransactionBuilder4 } from "@stellar/stellar-sdk";
var LocalKeypairWalletConnector = class {
  constructor(keypair) {
    this.keypair = keypair;
  }
  async getPublicKey() {
    return this.keypair.publicKey();
  }
  async signTransaction(transactionXdr, networkPassphrase) {
    const tx = TransactionBuilder4.fromXDR(transactionXdr, networkPassphrase);
    tx.sign(this.keypair);
    return tx.toXDR();
  }
};
export {
  LocalKeypairWalletConnector,
  StellarClient,
  VaultContract,
  buildContractCallOperation,
  buildContractCallTransaction,
  createHttpClientWithRetry,
  getDefaultRpcUrl,
  getNetworkPassphrase,
  resolveNetworkConfig,
  retry,
  toScVal
};
//# sourceMappingURL=index.mjs.map