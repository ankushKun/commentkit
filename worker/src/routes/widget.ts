import { Hono } from 'hono';
import { Database } from '../db';
import type { Env } from '../types';

const widget = new Hono<{ Bindings: Env }>();

// GET /api/v1/widget/verify-site - Public endpoint to check if a site is verified
// Used by the widget to determine if it should load on non-localhost domains
widget.get('/verify-site', async (c) => {
    const domain = c.req.query('domain');

    if (!domain) {
        return c.json({ error: 'Domain parameter is required' }, 400);
    }

    const db = new Database(c.env.DB);
    const site = await db.getSiteByDomain(domain);

    if (!site) {
        return c.json({
            verified: false,
            error: 'This domain is not registered with CommentKit.',
        });
    }

    if (!site.verified) {
        return c.json({
            verified: false,
            error: 'This site has not been verified. The site owner must verify domain ownership to enable comments.',
        });
    }

    return c.json({
        verified: true,
        site_id: site.id,
    });
});

export { widget };
