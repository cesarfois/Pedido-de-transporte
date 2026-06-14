import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_FILE = path.join(__dirname, 'tokens.json');

// Memory cache
let cachedTokens = null;
let refreshPromise = null;
let serviceAccountPromise = null;

export const tokenManager = {
    /**
     * Initialize: Read tokens from disk
     */
    init: async () => {
        try {
            const data = await fs.readFile(TOKENS_FILE, 'utf-8');
            cachedTokens = JSON.parse(data);
            console.log('[TokenManager] Loaded tokens.');
        } catch (error) {
            console.log('[TokenManager] No tokens found found or error reading file.');
            cachedTokens = null;
        }
    },

    /**
     * Get the cached tokens object
     */
    getTokens: () => cachedTokens,

    /**
     * Save tokens from Frontend login
     */
    setTokens: async (tokens) => {
        cachedTokens = {
            ...tokens,
            updatedAt: new Date().toISOString()
        };
        if (!(process.env.NETLIFY || process.env.VERCEL)) {
            await fs.writeFile(TOKENS_FILE, JSON.stringify(cachedTokens, null, 2));
        } else {
            console.log('[TokenManager] Serverless environment: keeping manual tokens in memory.');
        }
        console.log('[TokenManager] Tokens updated manually.');
    },

    /**
     * Get a valid Access Token.
     * Refreshes automatically if needed/possible.
     */
    getAccessToken: async () => {
        // 1. Try Cached Token first
        if (cachedTokens && cachedTokens.token) {
            const now = Date.now();
            // Buffer of 5 minutes (300000ms) to ensure safety
            if (cachedTokens.expiresAt && now < (cachedTokens.expiresAt - 300000)) {
                return cachedTokens.token;
            }
            console.warn('[TokenManager] Cached token expired or expiring soon. Refreshing...');
        }

        // 2. Refresh or Fallback
        try {
            return await tokenManager.refreshAccessToken();
        } catch (e) {
            console.warn('[TokenManager] Refresh failed. Attempting Service Account fallback...');
            // 3. Fallback to Service Account
            try {
                return await tokenManager.loginWithServiceAccount();
            } catch (fatalError) {
                console.error('[TokenManager] All auth methods failed.');
                throw new Error('No authentication session found and Service Account failed. Please login via the App.');
            }
        }
    },

    /**
     * Refresh the token using the stored Refresh Token.
     * Synchronized to prevent parallel refreshes.
     */
    refreshAccessToken: async () => {
        if (refreshPromise) {
            console.log('[TokenManager] Token refresh already in progress. Reusing promise...');
            return refreshPromise;
        }

        refreshPromise = (async () => {
            try {
                if (!cachedTokens || !cachedTokens.refreshToken) {
                    console.warn('[TokenManager] No refresh token available. Trying Service Account...');
                    return await tokenManager.loginWithServiceAccount();
                }

                console.log('[TokenManager] Refreshing token...');

                const params = new URLSearchParams();
                params.append('grant_type', 'refresh_token');
                params.append('refresh_token', cachedTokens.refreshToken);
                params.append('client_id', process.env.VITE_DOCUWARE_CLIENT_ID || 'docuware.platform');
                if (process.env.VITE_DOCUWARE_CLIENT_SECRET) {
                    params.append('client_secret', process.env.VITE_DOCUWARE_CLIENT_SECRET);
                }

                const tokenEndpoint = cachedTokens.tokenEndpoint || 'https://login-emea.docuware.cloud/oauth/token';

                const response = await axios.post(tokenEndpoint, params, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });

                const { access_token, refresh_token, expires_in } = response.data;

                // Update state
                cachedTokens = {
                    ...cachedTokens,
                    token: access_token,
                    accessToken: access_token, // normalize
                    refreshToken: refresh_token || cachedTokens.refreshToken, // RT rotation usually happens
                    expiresAt: Date.now() + ((expires_in || 3600) * 1000),
                    updatedAt: new Date().toISOString()
                };

                if (!(process.env.NETLIFY || process.env.VERCEL)) {
                    await fs.writeFile(TOKENS_FILE, JSON.stringify(cachedTokens, null, 2));
                } else {
                    console.log('[TokenManager] Serverless environment: keeping refreshed tokens in memory.');
                }
                console.log('[TokenManager] Token refreshed successfully.');

                return cachedTokens.token;

            } catch (err) {
                console.error('[TokenManager] Refresh failed:', err.response?.data || err.message);
                // Fallback to Service Account on hard failure
                console.warn('[TokenManager] Refresh failed. Attempting Service Account login...');
                return await tokenManager.loginWithServiceAccount();
            } finally {
                refreshPromise = null;
            }
        })();

        return refreshPromise;
    },

    /**
     * Login using Service Account Credentials (ROPC Flow)
     * This is the robust fallback for background tasks.
     */
    loginWithServiceAccount: async () => {
        if (serviceAccountPromise) {
            console.log('[TokenManager] Service Account login already in progress. Reusing promise...');
            return serviceAccountPromise;
        }

        serviceAccountPromise = (async () => {
            try {
                const username = process.env.DOCUWARE_USERNAME;
                const password = process.env.DOCUWARE_PASSWORD;

                if (!username || !password) {
                    throw new Error("Service Account credentials (DOCUWARE_USERNAME/PASSWORD) not configured in .env");
                }

                console.log('[TokenManager] 🔄 Attempting Service Account Login...');

                const orgId = process.env.DOCUWARE_ORG_ID;
                console.log(`[TokenManager] Service Login > Org ID: ${orgId}`);
                let tokenEndpoint = 'https://login-emea.docuware.cloud/connect/token'; // Fallback

                if (orgId) {
                    tokenEndpoint = `https://login-emea.docuware.cloud/${orgId}/connect/token`;
                } else if (cachedTokens && cachedTokens.tokenEndpoint) {
                    tokenEndpoint = cachedTokens.tokenEndpoint;
                }

                console.log(`[TokenManager] Using Token Endpoint: ${tokenEndpoint}`);

                const params = new URLSearchParams();
                params.append('grant_type', 'password');
                params.append('username', username);
                params.append('password', password);
                params.append('client_id', 'docuware.platform.net.client');
                params.append('scope', 'docuware.platform');

                const response = await axios.post(tokenEndpoint, params, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });

                const { access_token, refresh_token, expires_in } = response.data;

                // Save new session
                cachedTokens = {
                    ...cachedTokens, // Keep other info like tokenEndpoint if possible
                    token: access_token,
                    accessToken: access_token,
                    refreshToken: refresh_token,
                    expiresAt: Date.now() + ((expires_in || 3600) * 1000),
                    updatedAt: new Date().toISOString(),
                    isServiceAccount: true
                };

                if (!(process.env.NETLIFY || process.env.VERCEL)) {
                    await fs.writeFile(TOKENS_FILE, JSON.stringify(cachedTokens, null, 2));
                } else {
                    console.log('[TokenManager] Serverless environment: keeping service account tokens in memory.');
                }
                console.log('[TokenManager] ✅ Service Account Login Successful.');

                return access_token;

            } catch (error) {
                console.error('[TokenManager] ❌ Service Account Login Failed:', error.response?.data || error.message);
                throw error;
            } finally {
                serviceAccountPromise = null;
            }
        })();

        return serviceAccountPromise;
    }
};
