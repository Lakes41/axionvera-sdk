"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  LocalKeypairWalletConnector: () => LocalKeypairWalletConnector,
  StellarClient: () => StellarClient,
  VaultContract: () => VaultContract,
  buildContractCallOperation: () => buildContractCallOperation,
  buildContractCallTransaction: () => buildContractCallTransaction,
  createHttpClientWithRetry: () => createHttpClientWithRetry,
  getDefaultRpcUrl: () => getDefaultRpcUrl,
  getNetworkPassphrase: () => getNetworkPassphrase,
  resolveNetworkConfig: () => resolveNetworkConfig,
  retry: () => retry,
  toScVal: () => toScVal
});
module.exports = __toCommonJS(index_exports);

// src/client/stellarClient.ts
var import_stellar_sdk2 = require("@stellar/stellar-sdk");

// src/utils/networkConfig.ts
var import_stellar_sdk = require("@stellar/stellar-sdk");
var DEFAULT_RPC_URLS = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://soroban-mainnet.stellar.org"
};
function getNetworkPassphrase(network) {
  switch (network) {
    case "testnet":
      return import_stellar_sdk.Networks.TESTNET;
    case "mainnet":
      return import_stellar_sdk.Networks.PUBLIC;
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
var import_axios = __toESM(require("axios"));
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
  const client = import_axios.default.create({
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
      this.rpc = new import_stellar_sdk2.rpc.Server(this.rpcUrl, { allowHttp });
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
    return import_stellar_sdk2.TransactionBuilder.fromXDR(transactionXdr, networkPassphrase);
  }
  static getDefaultNetworkPassphrase(network) {
    switch (network) {
      case "testnet":
        return import_stellar_sdk2.Networks.TESTNET;
      case "mainnet":
        return import_stellar_sdk2.Networks.PUBLIC;
    }
  }
};

// src/contracts/vault.ts
var import_stellar_sdk4 = require("@stellar/stellar-sdk");

// src/utils/transactionBuilder.ts
var import_stellar_sdk3 = require("@stellar/stellar-sdk");
function toScVal(arg) {
  if (arg === null) {
    return import_stellar_sdk3.xdr.ScVal.scvVoid();
  }
  if (arg instanceof import_stellar_sdk3.Address) {
    return arg.toScVal();
  }
  if (typeof arg === "string") {
    try {
      return import_stellar_sdk3.Address.fromString(arg).toScVal();
    } catch {
      return (0, import_stellar_sdk3.nativeToScVal)(arg);
    }
  }
  if (typeof arg === "number") {
    return (0, import_stellar_sdk3.nativeToScVal)(arg);
  }
  if (typeof arg === "bigint") {
    return (0, import_stellar_sdk3.nativeToScVal)(arg, { type: "i128" });
  }
  if (typeof arg === "boolean") {
    return (0, import_stellar_sdk3.nativeToScVal)(arg);
  }
  return arg;
}
function buildContractCallOperation(params) {
  const contract = new import_stellar_sdk3.Contract(params.contractId);
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
  return new import_stellar_sdk3.TransactionBuilder(params.sourceAccount, {
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
        import_stellar_sdk4.Address.fromString(await this.getSourcePublicKey(params.from)).toScVal(),
        toScVal(params.amount)
      ]
    });
  }
  async withdraw(params) {
    return this.sendContractCall({
      source: params.from,
      method: this.methods.withdraw,
      args: [
        import_stellar_sdk4.Address.fromString(await this.getSourcePublicKey(params.from)).toScVal(),
        toScVal(params.amount)
      ]
    });
  }
  async claimRewards(params) {
    return this.sendContractCall({
      source: params?.from,
      method: this.methods.claimRewards,
      args: [import_stellar_sdk4.Address.fromString(await this.getSourcePublicKey(params?.from)).toScVal()]
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
      args: [import_stellar_sdk4.Address.fromString(publicKey)]
    });
    const sim = await this.client.simulateTransaction(tx);
    if (!isSimSuccess(sim)) {
      throw new Error("Simulation failed");
    }
    const retval = sim.result?.retval;
    return retval ? (0, import_stellar_sdk4.scValToNative)(retval) : null;
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
    const signedTx = import_stellar_sdk4.TransactionBuilder.fromXDR(
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
var import_stellar_sdk5 = require("@stellar/stellar-sdk");
var LocalKeypairWalletConnector = class {
  constructor(keypair) {
    this.keypair = keypair;
  }
  async getPublicKey() {
    return this.keypair.publicKey();
  }
  async signTransaction(transactionXdr, networkPassphrase) {
    const tx = import_stellar_sdk5.TransactionBuilder.fromXDR(transactionXdr, networkPassphrase);
    tx.sign(this.keypair);
    return tx.toXDR();
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
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
});
//# sourceMappingURL=index.js.map