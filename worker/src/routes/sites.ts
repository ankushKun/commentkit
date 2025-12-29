import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Database } from '../db';
import { getAuthUser } from '../middleware';
import type { Env } from '../types';

const sites = new Hono<{ Bindings: Env }>();

// Generate a secure API key
function generateApiKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

// GET /api/v1/sites - List user's sites
sites.get('/', async (c) => {
    const user = await getAuthUser(c);
    if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const db = new Database(c.env.DB);
    const userSites = await db.getSitesByOwner(user.id);

    // Don't expose full API keys in list view
    const sitesResponse = userSites.map((site) => ({
        id: site.id,
        name: site.name,
        domain: site.domain,
        api_key_preview: site.api_key.slice(0, 8) + '...',
        created_at: site.created_at,
        updated_at: site.updated_at,
    }));

    return c.json({ sites: sitesResponse });
});

// GET /api/v1/sites/overview - Get all sites with stats in single call (optimized for dashboard)
sites.get('/overview', async (c) => {
    const user = await getAuthUser(c);
    if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const db = new Database(c.env.DB);
    const { sites: userSites, aggregated } = await db.getSitesWithStats(user.id);

    // Don't expose full API keys
    const sitesResponse = userSites.map((site) => ({
        id: site.id,
        name: site.name,
        domain: site.domain,
        api_key_preview: site.api_key.slice(0, 8) + '...',
        created_at: site.created_at,
        updated_at: site.updated_at,
        stats: {
            total_pages: site.total_pages,
            total_comments: site.total_comments,
            pending_comments: site.pending_comments,
            total_likes: site.total_likes,
        },
    }));

    return c.json({
        sites: sitesResponse,
        aggregated,
    });
});

// GET /api/v1/sites/:id - Get site details with stats and comments (optimized)
sites.get('/:id', async (c) => {
    const user = await getAuthUser(c);
    if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const siteId = parseInt(c.req.param('id'));
    if (isNaN(siteId)) {
        return c.json({ error: 'Invalid site_id' }, 400);
    }

    // Parse query params for comments
    const commentStatus = c.req.query('comment_status');
    const commentLimit = parseInt(c.req.query('comment_limit') || '50');
    const commentOffset = parseInt(c.req.query('comment_offset') || '0');
    const includeComments = c.req.query('include_comments') !== 'false';

    const db = new Database(c.env.DB);

    // Single optimized call for site, stats, and comments
    const result = await db.getSiteWithDetails(siteId, {
        status: commentStatus,
        limit: commentLimit,
        offset: commentOffset,
    });

    if (!result || !result.site) {
        return c.json({ error: 'Site not found' }, 404);
    }

    // Check ownership
    if (result.site.owner_id !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
    }

    return c.json({
        id: result.site.id,
        name: result.site.name,
        domain: result.site.domain,
        api_key: result.site.api_key,
        settings: JSON.parse(result.site.settings || '{}'),
        created_at: result.site.created_at,
        updated_at: result.site.updated_at,
        stats: result.stats,
        ...(includeComments && {
            comments: result.comments.comments,
            comments_total: result.comments.total,
        }),
    });
});

// POST /api/v1/sites - Create a new site
const createSiteSchema = z.object({
    name: z.string().min(1).max(100),
    domain: z.string().min(1).max(255),
});

sites.post('/', zValidator('json', createSiteSchema), async (c) => {
    const user = await getAuthUser(c);
    if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const body = c.req.valid('json');
    const db = new Database(c.env.DB);

    // Check if domain already exists
    const existingSite = await db.getSiteByDomain(body.domain);
    if (existingSite) {
        return c.json({ error: 'Domain already registered' }, 409);
    }

    const apiKey = generateApiKey();
    const site = await db.createSite(body.name, body.domain, apiKey, user.id);

    return c.json(
        {
            id: site.id,
            name: site.name,
            domain: site.domain,
            api_key: site.api_key,
            created_at: site.created_at,
        },
        201
    );
});

// PATCH /api/v1/sites/:id - Update site
const updateSiteSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    domain: z.string().min(1).max(255).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
});

sites.patch('/:id', zValidator('json', updateSiteSchema), async (c) => {
    const user = await getAuthUser(c);
    if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const siteId = parseInt(c.req.param('id'));
    if (isNaN(siteId)) {
        return c.json({ error: 'Invalid site_id' }, 400);
    }

    const body = c.req.valid('json');
    const db = new Database(c.env.DB);

    const site = await db.getSiteById(siteId);
    if (!site) {
        return c.json({ error: 'Site not found' }, 404);
    }

    if (site.owner_id !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
    }

    // Check domain uniqueness if changing
    if (body.domain && body.domain !== site.domain) {
        const existingSite = await db.getSiteByDomain(body.domain);
        if (existingSite) {
            return c.json({ error: 'Domain already registered' }, 409);
        }
    }

    const updated = await db.updateSite(siteId, {
        name: body.name,
        domain: body.domain,
        settings: body.settings ? JSON.stringify(body.settings) : undefined,
    });

    return c.json({
        id: updated.id,
        name: updated.name,
        domain: updated.domain,
        settings: JSON.parse(updated.settings || '{}'),
        updated_at: updated.updated_at,
    });
});

// DELETE /api/v1/sites/:id - Delete site
sites.delete('/:id', async (c) => {
    const user = await getAuthUser(c);
    if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const siteId = parseInt(c.req.param('id'));
    if (isNaN(siteId)) {
        return c.json({ error: 'Invalid site_id' }, 400);
    }

    const db = new Database(c.env.DB);
    const site = await db.getSiteById(siteId);

    if (!site) {
        return c.json({ error: 'Site not found' }, 404);
    }

    if (site.owner_id !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
    }

    await db.deleteSite(siteId);

    return c.json({ success: true });
});

// POST /api/v1/sites/:id/regenerate-key - Regenerate API key
sites.post('/:id/regenerate-key', async (c) => {
    const user = await getAuthUser(c);
    if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const siteId = parseInt(c.req.param('id'));
    if (isNaN(siteId)) {
        return c.json({ error: 'Invalid site_id' }, 400);
    }

    const db = new Database(c.env.DB);
    const site = await db.getSiteById(siteId);

    if (!site) {
        return c.json({ error: 'Site not found' }, 404);
    }

    if (site.owner_id !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
    }

    const newApiKey = generateApiKey();
    await db.updateSiteApiKey(siteId, newApiKey);

    return c.json({ api_key: newApiKey });
});

// GET /api/v1/sites/:id/stats - Get site statistics
sites.get('/:id/stats', async (c) => {
    const user = await getAuthUser(c);
    if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const siteId = parseInt(c.req.param('id'));
    if (isNaN(siteId)) {
        return c.json({ error: 'Invalid site_id' }, 400);
    }

    const db = new Database(c.env.DB);
    const site = await db.getSiteById(siteId);

    if (!site) {
        return c.json({ error: 'Site not found' }, 404);
    }

    if (site.owner_id !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
    }

    const stats = await db.getSiteStats(siteId);

    return c.json(stats);
});

export { sites };
