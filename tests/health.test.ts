import { describe, it, expect } from 'bun:test';
import { api, BASE_URL } from './helpers';

describe('Health & Core', () => {
    describe('GET /health', () => {
        it('should return health status', async () => {
            const { status, json } = await api('/health');
            expect(status).toBe(200);
            expect(json.status).toBe('ok');
            expect(json.version).toBe('1.0.0');
            expect(json.timestamp).toBeDefined();
        });
    });

    describe('404 Handler', () => {
        it('should return 404 for unknown routes', async () => {
            const { status, json } = await api('/api/v1/unknown-route');
            expect(status).toBe(404);
            expect(json.error).toBe('Not found');
        });
    });

    describe('CORS', () => {
        it('should handle OPTIONS preflight', async () => {
            const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
                method: 'OPTIONS',
            });
            expect(res.status).toBe(200);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
            expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
        });

        it('should include CORS headers in responses', async () => {
            const res = await fetch(`${BASE_URL}/health`);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
        });
    });
});
