import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Database } from '../db';
import { getAuthUser, requireSuperAdmin } from '../middleware';
import type { Env } from '../types';

const superadmin = new Hono<{ Bindings: Env }>();

// Apply superadmin middleware to all routes
superadmin.use('*', requireSuperAdmin);

// ==========================================
// Analytics
// ==========================================

// GET /api/v1/superadmin/stats - Get global platform statistics
superadmin.get('/stats', async (c) => {
    const db = new Database(c.env.DB);
    const stats = await db.getGlobalStats();
    return c.json(stats);
});

// GET /api/v1/superadmin/activity - Get recent platform activity
superadmin.get('/activity', async (c) => {
    const limit = parseInt(c.req.query('limit') || '10');
    const db = new Database(c.env.DB);
    const activity = await db.getRecentActivity(limit);

    // Sanitize sensitive data
    const sanitizedActivity = {
        recent_users: activity.recent_users.map((u) => ({
            id: u.id,
            email: u.email,
            display_name: u.display_name,
            is_admin: u.is_admin === 1,
            created_at: u.created_at,
        })),
        recent_sites: activity.recent_sites.map((s) => ({
            id: s.id,
            name: s.name,
            domain: s.domain,
            owner_id: s.owner_id,
            created_at: s.created_at,
        })),
        recent_comments: activity.recent_comments.map((c) => ({
            id: c.id,
            content: c.content.slice(0, 100) + (c.content.length > 100 ? '...' : ''),
            status: c.status,
            author_name: c.author_name,
            site_id: c.site_id,
            created_at: c.created_at,
        })),
    };

    return c.json(sanitizedActivity);
});

// ==========================================
// User Management
// ==========================================

// GET /api/v1/superadmin/users - List all users
superadmin.get('/users', async (c) => {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const search = c.req.query('search');

    const db = new Database(c.env.DB);
    const result = await db.getAllUsers({ limit, offset, search });

    const sanitizedUsers = result.users.map((u) => ({
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        email_verified: u.email_verified === 1,
        is_admin: u.is_admin === 1,
        created_at: u.created_at,
        updated_at: u.updated_at,
    }));

    return c.json({
        users: sanitizedUsers,
        total: result.total,
        limit,
        offset,
    });
});

// GET /api/v1/superadmin/users/:id - Get user details
superadmin.get('/users/:id', async (c) => {
    const userId = parseInt(c.req.param('id'));
    if (isNaN(userId)) {
        return c.json({ error: 'Invalid user_id' }, 400);
    }

    const db = new Database(c.env.DB);
    const result = await db.getUserWithStats(userId);

    if (!result.user) {
        return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
        user: {
            id: result.user.id,
            email: result.user.email,
            display_name: result.user.display_name,
            email_verified: result.user.email_verified === 1,
            is_admin: result.user.is_admin === 1,
            created_at: result.user.created_at,
            updated_at: result.user.updated_at,
        },
        stats: result.stats,
    });
});

// PATCH /api/v1/superadmin/users/:id/admin - Set user admin status
const setAdminSchema = z.object({
    is_admin: z.boolean(),
});

superadmin.patch('/users/:id/admin', zValidator('json', setAdminSchema), async (c) => {
    const userId = parseInt(c.req.param('id'));
    if (isNaN(userId)) {
        return c.json({ error: 'Invalid user_id' }, 400);
    }

    const body = c.req.valid('json');
    const db = new Database(c.env.DB);

    const user = await db.getUserById(userId);
    if (!user) {
        return c.json({ error: 'User not found' }, 404);
    }

    // Prevent removing own admin status
    const currentUser = await getAuthUser(c);
    if (currentUser?.id === userId && !body.is_admin) {
        return c.json({ error: 'Cannot remove your own admin status' }, 400);
    }

    await db.setUserAdmin(userId, body.is_admin);

    return c.json({
        id: userId,
        is_admin: body.is_admin,
        updated: true,
    });
});

// DELETE /api/v1/superadmin/users/:id - Delete user
superadmin.delete('/users/:id', async (c) => {
    const userId = parseInt(c.req.param('id'));
    if (isNaN(userId)) {
        return c.json({ error: 'Invalid user_id' }, 400);
    }

    const db = new Database(c.env.DB);
    const user = await db.getUserById(userId);

    if (!user) {
        return c.json({ error: 'User not found' }, 404);
    }

    // Prevent deleting own account
    const currentUser = await getAuthUser(c);
    if (currentUser?.id === userId) {
        return c.json({ error: 'Cannot delete your own account' }, 400);
    }

    // Prevent deleting other admins
    if (user.is_admin === 1) {
        return c.json({ error: 'Cannot delete admin users. Remove admin status first.' }, 400);
    }

    await db.deleteUser(userId);

    return c.json({ success: true });
});

// ==========================================
// Site Management
// ==========================================

// GET /api/v1/superadmin/sites - List all sites
superadmin.get('/sites', async (c) => {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const search = c.req.query('search');

    const db = new Database(c.env.DB);
    const result = await db.getAllSites({ limit, offset, search });

    const sanitizedSites = result.sites.map((s) => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        owner_id: s.owner_id,
        owner_email: s.owner_email,
        created_at: s.created_at,
        updated_at: s.updated_at,
    }));

    return c.json({
        sites: sanitizedSites,
        total: result.total,
        limit,
        offset,
    });
});

// GET /api/v1/superadmin/sites/:id - Get site details
superadmin.get('/sites/:id', async (c) => {
    const siteId = parseInt(c.req.param('id'));
    if (isNaN(siteId)) {
        return c.json({ error: 'Invalid site_id' }, 400);
    }

    const db = new Database(c.env.DB);
    const site = await db.getSiteById(siteId);

    if (!site) {
        return c.json({ error: 'Site not found' }, 404);
    }

    const stats = await db.getSiteStats(siteId);
    const owner = site.owner_id ? await db.getUserById(site.owner_id) : null;

    return c.json({
        site: {
            id: site.id,
            name: site.name,
            domain: site.domain,
            api_key: site.api_key,
            settings: JSON.parse(site.settings || '{}'),
            owner_id: site.owner_id,
            owner_email: owner?.email,
            created_at: site.created_at,
            updated_at: site.updated_at,
        },
        stats,
    });
});

// PATCH /api/v1/superadmin/sites/:id/owner - Transfer site ownership
const transferOwnershipSchema = z.object({
    new_owner_id: z.number(),
});

superadmin.patch('/sites/:id/owner', zValidator('json', transferOwnershipSchema), async (c) => {
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

    const newOwner = await db.getUserById(body.new_owner_id);
    if (!newOwner) {
        return c.json({ error: 'New owner not found' }, 404);
    }

    await db.transferSiteOwnership(siteId, body.new_owner_id);

    return c.json({
        id: siteId,
        new_owner_id: body.new_owner_id,
        new_owner_email: newOwner.email,
        updated: true,
    });
});

// DELETE /api/v1/superadmin/sites/:id - Delete site
superadmin.delete('/sites/:id', async (c) => {
    const siteId = parseInt(c.req.param('id'));
    if (isNaN(siteId)) {
        return c.json({ error: 'Invalid site_id' }, 400);
    }

    const db = new Database(c.env.DB);
    const site = await db.getSiteById(siteId);

    if (!site) {
        return c.json({ error: 'Site not found' }, 404);
    }

    await db.deleteSite(siteId);

    return c.json({ success: true });
});

// ==========================================
// Comment Management
// ==========================================

// GET /api/v1/superadmin/comments - List all comments
superadmin.get('/comments', async (c) => {
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    const status = c.req.query('status');
    const siteId = c.req.query('site_id') ? parseInt(c.req.query('site_id')!) : undefined;

    const db = new Database(c.env.DB);
    const result = await db.getAllComments({ limit, offset, status, siteId });

    return c.json({
        comments: result.comments,
        total: result.total,
        limit,
        offset,
    });
});

// GET /api/v1/superadmin/comments/:id - Get comment details
superadmin.get('/comments/:id', async (c) => {
    const commentId = parseInt(c.req.param('id'));
    if (isNaN(commentId)) {
        return c.json({ error: 'Invalid comment_id' }, 400);
    }

    const db = new Database(c.env.DB);
    const comment = await db.getCommentById(commentId);

    if (!comment) {
        return c.json({ error: 'Comment not found' }, 404);
    }

    // Get related info
    const [site, user] = await Promise.all([
        db.getSiteById(comment.site_id),
        comment.user_id ? db.getUserById(comment.user_id) : null,
    ]);

    return c.json({
        comment,
        site: site
            ? { id: site.id, name: site.name, domain: site.domain }
            : null,
        user: user
            ? { id: user.id, email: user.email, display_name: user.display_name }
            : null,
    });
});

// PATCH /api/v1/superadmin/comments/:id/status - Moderate single comment
const moderateSchema = z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'spam']),
});

superadmin.patch('/comments/:id/status', zValidator('json', moderateSchema), async (c) => {
    const commentId = parseInt(c.req.param('id'));
    if (isNaN(commentId)) {
        return c.json({ error: 'Invalid comment_id' }, 400);
    }

    const body = c.req.valid('json');
    const db = new Database(c.env.DB);

    const comment = await db.getCommentById(commentId);
    if (!comment) {
        return c.json({ error: 'Comment not found' }, 404);
    }

    await db.updateCommentStatus(commentId, body.status);

    return c.json({
        id: commentId,
        status: body.status,
        updated: true,
    });
});

// POST /api/v1/superadmin/comments/bulk-status - Bulk moderate comments
const bulkModerateSchema = z.object({
    comment_ids: z.array(z.number()).min(1).max(100),
    status: z.enum(['pending', 'approved', 'rejected', 'spam']),
});

superadmin.post('/comments/bulk-status', zValidator('json', bulkModerateSchema), async (c) => {
    const body = c.req.valid('json');
    const db = new Database(c.env.DB);

    const updated = await db.bulkUpdateCommentStatus(body.comment_ids, body.status);

    return c.json({
        updated_count: updated,
        status: body.status,
    });
});

// DELETE /api/v1/superadmin/comments/:id - Delete single comment
superadmin.delete('/comments/:id', async (c) => {
    const commentId = parseInt(c.req.param('id'));
    if (isNaN(commentId)) {
        return c.json({ error: 'Invalid comment_id' }, 400);
    }

    const db = new Database(c.env.DB);
    const comment = await db.getCommentById(commentId);

    if (!comment) {
        return c.json({ error: 'Comment not found' }, 404);
    }

    await db.deleteComment(commentId);

    return c.json({ success: true });
});

// POST /api/v1/superadmin/comments/bulk-delete - Bulk delete comments
const bulkDeleteSchema = z.object({
    comment_ids: z.array(z.number()).min(1).max(100),
});

superadmin.post('/comments/bulk-delete', zValidator('json', bulkDeleteSchema), async (c) => {
    const body = c.req.valid('json');
    const db = new Database(c.env.DB);

    const deleted = await db.bulkDeleteComments(body.comment_ids);

    return c.json({
        deleted_count: deleted,
    });
});

export { superadmin };
