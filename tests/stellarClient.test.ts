import { Keypair, TransactionBuilder, Networks } from "@stellar/stellar-sdk";
import { StellarClient } from "../src/client/stellarClient";
import { setupMswTest, overrideHandlers, rest } from "../src/index";

describe("StellarClient Unit Tests", () => {
  // Establish the mocked network interfaces using MSW as per project standards
  // This prevents tests from hitting live servers and ensures consistent results
  setupMswTest();

  describe("Initialization", () => {
    it("should initialize with default testnet settings", () => {
      const client = new StellarClient({ network: "testnet" });
      expect(client.network).toBe("testnet");
      expect(client.rpcUrl).toBe("https://soroban-testnet.stellar.org");
      expect(client.networkPassphrase).toBe(Networks.TESTNET);
    });

    it("should initialize with custom RPC URL and passphrase", () => {
      const customRpc = "https://custom-rpc.com";
      const customPassphrase = "Custom Network ; September 2023";
      const client = new StellarClient({
        rpcUrl: customRpc,
        networkPassphrase: customPassphrase
      });
      expect(client.rpcUrl).toBe(customRpc);
      expect(client.networkPassphrase).toBe(customPassphrase);
    });

    it("should merge concurrency configuration", () => {
      const client = new StellarClient({
        concurrencyConfig: { maxConcurrentRequests: 10 }
      });
      const stats = client.getConcurrencyStats();
      expect(stats.enabled).toBe(true);
      expect(stats.maxConcurrentRequests).toBe(10);
    });
  });

  describe("Core RPC Methods (Mocked)", () => {
    let client: StellarClient;

    beforeEach(() => {
      client = new StellarClient({ network: "testnet" });
    });

    it("should fetch network health via mocked interface", async () => {
      const health = await client.getHealth();
      expect(health).toEqual({ status: "healthy", version: "20.0.0" });
    });

    it("should fetch account details via mocked interface", async () => {
      const publicKey = "GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V";
      const account = await client.getAccount(publicKey);
      expect(account.accountId()).toBe(publicKey);
    });

    it("should handle RPC errors gracefully", async () => {
      // Manually override for error simulation
      overrideHandlers(
        rest.get("https://soroban-testnet.stellar.org/health", (_req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: "Internal Server Error" }));
        })
      );

      await expect(client.getHealth()).rejects.toThrow("Failed to fetch network health");
    });
  });

  describe("Authentication and Signing Flow", () => {
    it("should sign a transaction with a local keypair", async () => {
      const client = new StellarClient({ network: "testnet" });
      const sourceKeypair = Keypair.random();
      const destination = Keypair.random().publicKey();
      
      // Use the client to get an Account object (mocked) for the builder
      const account = await client.getAccount(sourceKeypair.publicKey());
      
      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: client.networkPassphrase
      })
        .addOperation(TransactionBuilder.payment({
          destination,
          asset: TransactionBuilder.native(),
          amount: "10"
        }))
        .setTimeout(30)
        .build();

      const signedTx = await client.signWithKeypair(tx, sourceKeypair);
      expect(signedTx.signatures.length).toBe(1);
    });
  });
});