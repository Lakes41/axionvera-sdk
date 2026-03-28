import { StellarClient } from "../src";
import { RateLimitError } from "../src/errors/axionveraError";

describe("StellarClient", () => {
  test("delegates network calls to the RPC client", async () => {
    const rpc = {
      getHealth: jest.fn().mockResolvedValue({ status: "healthy" }),
      getNetwork: jest.fn().mockResolvedValue({ passphrase: "TESTNET" }),
      getLatestLedger: jest.fn().mockResolvedValue({ sequence: 123 }),
      getAccount: jest.fn(),
      simulateTransaction: jest.fn(),
      prepareTransaction: jest.fn(),
      sendTransaction: jest.fn(),
      getTransaction: jest.fn()
    };

    const client = new StellarClient({
      network: "testnet",
      rpcUrl: "http://localhost:8000",
      networkPassphrase: "Test Network ; February 2017",
      rpcClient: rpc as any
    });

    await expect(client.getHealth()).resolves.toEqual({ status: "healthy" });
    await expect(client.getNetwork()).resolves.toEqual({ passphrase: "TESTNET" });
    await expect(client.getLatestLedger()).resolves.toEqual({ sequence: 123 });

    expect(rpc.getHealth).toHaveBeenCalledTimes(1);
    expect(rpc.getNetwork).toHaveBeenCalledTimes(1);
    expect(rpc.getLatestLedger).toHaveBeenCalledTimes(1);
  });

  test("polls a transaction until it is found", async () => {
    const rpc = {
      getHealth: jest.fn(),
      getNetwork: jest.fn(),
      getLatestLedger: jest.fn(),
      getAccount: jest.fn(),
      simulateTransaction: jest.fn(),
      prepareTransaction: jest.fn(),
      sendTransaction: jest.fn(),
      getTransaction: jest
        .fn()
        .mockResolvedValueOnce({ status: "NOT_FOUND" })
        .mockResolvedValueOnce({ status: "SUCCESS", resultMetaXdr: "AAAA" })
    };

    const client = new StellarClient({
      network: "testnet",
      rpcUrl: "http://localhost:8000",
      networkPassphrase: "Test Network ; February 2017",
      rpcClient: rpc as any
    });

    await expect(
      client.pollTransaction("deadbeef", { timeoutMs: 2_000, intervalMs: 1 })
    ).resolves.toEqual({ status: "SUCCESS", resultMetaXdr: "AAAA" });

    expect(rpc.getTransaction).toHaveBeenCalledTimes(2);
  });

  test("wraps RPC errors with status code and request id metadata", async () => {
    const rpc = {
      getHealth: jest.fn().mockRejectedValue({
        response: {
          status: 429,
          headers: {
            'x-request-id': 'req-health-42'
          }
        }
      }),
      getNetwork: jest.fn(),
      getLatestLedger: jest.fn(),
      getAccount: jest.fn(),
      simulateTransaction: jest.fn(),
      prepareTransaction: jest.fn(),
      sendTransaction: jest.fn(),
      getTransaction: jest.fn()
    };

    const client = new StellarClient({
      network: "testnet",
      rpcUrl: "http://localhost:8000",
      networkPassphrase: "Test Network ; February 2017",
      rpcClient: rpc as any,
      retryConfig: { enabled: false }
    });

    let thrown: unknown;
    try {
      await client.getHealth();
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(RateLimitError);
    expect(thrown).toMatchObject({
      statusCode: 429,
      requestId: 'req-health-42'
    });
  });
});
