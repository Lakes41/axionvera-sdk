import { AxiosInstance } from 'axios';
export type RetryConfig = {
    enabled: boolean;
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    retryableMethods: string[];
    retryableStatusCodes: number[];
};
export declare const DEFAULT_RETRY_CONFIG: RetryConfig;
export declare function createHttpClientWithRetry(retryConfig?: Partial<RetryConfig>): AxiosInstance;
export declare function retry<T>(fn: () => Promise<T>, retryConfig?: Partial<RetryConfig>): Promise<T>;
//# sourceMappingURL=httpInterceptor.d.ts.map