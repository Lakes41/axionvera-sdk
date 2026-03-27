"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RETRY_CONFIG = void 0;
exports.createHttpClientWithRetry = createHttpClientWithRetry;
exports.retry = retry;
const axios_1 = __importDefault(require("axios"));
exports.DEFAULT_RETRY_CONFIG = {
    enabled: true,
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 8000,
    retryableMethods: ['GET', 'PUT'],
    retryableStatusCodes: [429, 500, 502, 503, 504]
};
function calculateDelay(attemptNumber, baseDelayMs, maxDelayMs) {
    const delay = baseDelayMs * Math.pow(2, attemptNumber - 1);
    return Math.min(delay, maxDelayMs);
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
    return new Promise(resolve => setTimeout(resolve, ms));
}
function createHttpClientWithRetry(retryConfig = {}) {
    const config = { ...exports.DEFAULT_RETRY_CONFIG, ...retryConfig };
    const client = axios_1.default.create({
        timeout: 30000,
    });
    if (!config.enabled) {
        return client;
    }
    client.interceptors.response.use((response) => response, async (error) => {
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
    });
    return client;
}
async function retry(fn, retryConfig = {}) {
    const config = { ...exports.DEFAULT_RETRY_CONFIG, ...retryConfig };
    if (!config.enabled) {
        return fn();
    }
    let lastError;
    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            // Check if this is a retryable error
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
