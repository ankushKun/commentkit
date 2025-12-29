/**
 * Shared test utilities for Thread Engine API Tests
 *
 * Prerequisites:
 * 1. Run `bun run db:migrate:local`
 * 2. Start dev server: `bun run dev`
 * 3. Run tests: `bun test`
 */

export const BASE_URL = 'http://localhost:8787';

// Helper to make requests
export async function api(path: string, options?: RequestInit) {
    const res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });
    return {
        status: res.status,
        json: await res.json().catch(() => null),
        headers: res.headers,
    };
}
