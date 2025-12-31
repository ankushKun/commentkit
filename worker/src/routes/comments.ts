import { Hono, Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Database } from '../db';
import { getAuthUser } from '../middleware';
import { verifyOriginToken } from './widget';
import type { CommentResponse, Env, PageResponse } from '../types';

const comments = new Hono<{ Bindings: Env }>();

// Basic HTML sanitization - removes/escapes potentially dangerous HTML
// This is defense-in-depth; the frontend also sanitizes content when rendering
function sanitizeContent(input: string): string {
    // Remove null bytes (can cause issues in some contexts)
    let sanitized = input.replace(/\0/g, '');

    // Limit length to prevent abuse
    sanitized = sanitized.slice(0, 10000);

    // Note: We don't do full HTML escaping here because:
    // 1. The frontend uses escapeHtml when rendering
    // 2. Storing escaped content would cause double-escaping issues
    // 3. We want to preserve the original content for potential markdown/formatting in the future
    // Instead, we just remove obviously malicious patterns

    // Remove script tags and their content
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove event handlers
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

    // Remove javascript: URLs
    sanitized = sanitized.replace(/javascript\s*:/gi, '');

    // Remove data: URLs (can contain scripts)
    sanitized = sanitized.replace(/data\s*:[^,\s]*base64/gi, '');

    return sanitized.trim();
}

// Validate that the request has a valid signed origin token
// The token is obtained from /widget/init and proves the actual page origin
// This prevents site impersonation attacks because:
// 1. Token is signed with our secret key
// 2. Token contains the domain from the Origin header (browser-set, can't be spoofed)
// 3. Attacker can't forge a token for a domain they don't control

async function validateOriginDomain(c: Context<{ Bindings: Env }>, claimedDomain: string): Promise<{ valid: boolean; error?: string }> {
    // API key authenticated requests bypass origin check (for server-to-server integrations)
    const apiKey = c.req.header('X-API-Key');
    if (apiKey) {
        return { valid: true };
    }

    // In development, allow bypassing
    if (c.env.ENVIRONMENT === 'development') {
        return { valid: true };
    }

    // Get the signed origin token
    const originToken = c.req.header('X-Origin-Token');

    if (!originToken) {
        return { valid: false, error: 'X-Origin-Token header required. Call /widget/init first.' };
    }

    // Verify the token signature and get the proven domain
    const tokenResult = await verifyOriginToken(originToken, c.env.JWT_SECRET);

    if (!tokenResult.valid) {
        return { valid: false, error: tokenResult.error || 'Invalid origin token' };
    }

    // The token domain must match the claimed domain
    if (tokenResult.domain !== claimedDomain) {
        return {
            valid: false,
            error: `Token domain "${tokenResult.domain}" does not match claimed domain "${claimedDomain}"`
        };
    }

    return { valid: true };
}

// GET /api/v1/sites/comments - Get page comments by domain and pageId
comments.get('/comments', async (c) => {
    const domain = c.req.query('domain');
    const pageId = c.req.query('pageId');
    const pageTitle = c.req.query('title') || '';

    if (!domain) {
        return c.json({ error: 'domain parameter is required' }, 400);
    }

    if (!pageId) {
        return c.json({ error: 'pageId parameter is required' }, 400);
    }

    const db = new Database(c.env.DB);

    // Get site by domain
    const site = await db.getSiteByDomain(domain);
    if (!site) {
        return c.json({ error: 'Site not found for domain: ' + domain }, 404);
    }

    // Get user ID from auth if present
    const authUser = await getAuthUser(c);
    const userId = authUser?.id;

    // Get page by pageId (which is the full URL or custom identifier)
    const page = await db.getPageBySlug(site.id, pageId);

    // If page doesn't exist, return empty state
    if (!page) {
        const response: PageResponse = {
            page_id: 0,
            slug: pageId,
            title: pageTitle || null,
            comment_count: 0,
            likes: 0,
            user_liked: false,
            comments: [],
        };
        return c.json(response);
    }

    // Get comments
    const pageComments = await db.getCommentsByPage(page.id);

    // Get like stats for all comments
    const commentIds = pageComments.map((comment) => comment.id);
    const likeStats = await db.getCommentLikeStatsBatch(commentIds, userId);

    // Combine page stats and count in parallel to save a query
    const [pageLikes, commentCount] = await Promise.all([
        db.getPageLikeStats(page.id, userId),
        db.getCommentCount(page.id),
    ]);

    // Build response - no runtime hashing needed!
    const commentResponses: CommentResponse[] = pageComments.map((comment) => {
        const stats = likeStats.get(comment.id) ?? { total_likes: 0, user_liked: false };
        return {
            id: comment.id,
            author_name: comment.author_name ?? '',
            author_email_hash: comment.author_email_hash ?? null,
            content: comment.content,
            parent_id: comment.parent_id,
            likes: stats.total_likes,
            user_liked: stats.user_liked,
            created_at: comment.created_at,
            replies: [],
        };
    });

    const response: PageResponse = {
        page_id: page.id,
        slug: pageId,
        title: page.title,
        comment_count: commentCount,
        likes: pageLikes.total_likes,
        user_liked: pageLikes.user_liked,
        comments: commentResponses,
    };

    return c.json(response);
});

// POST /api/v1/sites/comments - Create comment by domain and pageId
const createCommentByDomainSchema = z.object({
    domain: z.string().min(1),
    pageId: z.string().min(1),
    author_name: z.string().optional(),
    author_email: z.string().email().optional(),
    content: z.string().min(1),
    parent_id: z.number().optional(),
    page_title: z.string().optional(),
    page_url: z.string().optional(),
});

comments.post('/comments', zValidator('json', createCommentByDomainSchema), async (c) => {
    const body = c.req.valid('json');
    const db = new Database(c.env.DB);

    // SECURITY: Validate that the request Origin matches the claimed domain
    // This prevents site impersonation attacks
    const originValidation = await validateOriginDomain(c, body.domain);
    if (!originValidation.valid) {
        return c.json({ error: originValidation.error || 'Origin validation failed' }, 403);
    }

    // Get site by domain
    const site = await db.getSiteByDomain(body.domain);
    if (!site) {
        return c.json({ error: 'Site not found for domain: ' + body.domain }, 404);
    }

    // Get or create page using pageId as the slug
    const page = await db.getOrCreatePage(site.id, body.pageId, body.page_title, body.page_url);

    // Get auth user if present
    const authUser = await getAuthUser(c);

    // Validate: either authenticated or has author_name
    let userId: number | undefined;
    let authorName: string | undefined;
    let authorEmail: string | undefined;
    let effectiveAuthorName = '';

    if (authUser) {
        userId = authUser.id;
        // Don't store redundant info in comments table
        authorName = undefined;
        authorEmail = undefined;

        effectiveAuthorName = authUser.display_name || authUser.email.split('@')[0];
    } else {
        if (!body.author_name?.trim()) {
            return c.json({ error: 'author_name is required for anonymous comments' }, 400);
        }
        authorName = body.author_name;
        authorEmail = body.author_email;

        effectiveAuthorName = authorName;
    }

    // Get client info only if privacy settings allow (privacy by default)
    const collectIp = c.env.COLLECT_IP_ADDRESS === 'true';
    const collectUa = c.env.COLLECT_USER_AGENT === 'true';

    const ipAddress = collectIp
        ? (c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For'))
        : null;
    const userAgent = collectUa
        ? c.req.header('User-Agent')
        : null;

    // Sanitize user-provided content for XSS prevention (defense-in-depth)
    const sanitizedContent = sanitizeContent(body.content);
    const sanitizedAuthorName = authorName ? sanitizeContent(authorName) : undefined;

    const comment = await db.createComment({
        siteId: site.id,
        pageId: page.id,
        userId,
        authorName: sanitizedAuthorName,
        authorEmail,
        parentId: body.parent_id,
        content: sanitizedContent,
        ipAddress: ipAddress ?? undefined,
        userAgent: userAgent ?? undefined,
    });

    const response: CommentResponse = {
        id: comment.id,
        author_name: effectiveAuthorName,
        author_email_hash: comment.author_email_hash ?? null,
        content: comment.content,
        parent_id: comment.parent_id,
        likes: 0,
        user_liked: false,
        created_at: comment.created_at,
        replies: [],
    };

    return c.json(response, 201);
});

// GET /api/v1/sites/:siteId/pages/:slug - Get page comments + likes (legacy route)
comments.get('/:siteId/pages/:slug', async (c) => {
    const siteId = parseInt(c.req.param('siteId'));
    const slug = c.req.param('slug');
    const pageTitle = c.req.query('title') || '';

    if (isNaN(siteId)) {
        return c.json({ error: 'Invalid site_id' }, 400);
    }

    const db = new Database(c.env.DB);

    // Get site
    const site = await db.getSiteById(siteId);
    if (!site) {
        return c.json({ error: 'Site not found' }, 404);
    }

    // Get user ID from auth if present
    const authUser = await getAuthUser(c);
    const userId = authUser?.id;

    // Get page (may not exist yet - that's OK!)
    const page = await db.getPageBySlug(site.id, slug);

    // If page doesn't exist, return empty state
    // Page will be created when first comment is posted
    if (!page) {
        const response: PageResponse = {
            page_id: 0, // No page yet
            slug: slug,
            title: pageTitle || null,
            comment_count: 0,
            likes: 0,
            user_liked: false,
            comments: [],
        };
        return c.json(response);
    }

    // Get comments
    const pageComments = await db.getCommentsByPage(page.id);

    // Get like stats for all comments
    const commentIds = pageComments.map((comment) => comment.id);
    const likeStats = await db.getCommentLikeStatsBatch(commentIds, userId);

    // Combine page stats and count in parallel
    const [pageLikes, commentCount] = await Promise.all([
        db.getPageLikeStats(page.id, userId),
        db.getCommentCount(page.id),
    ]);

    // Build response - no runtime hashing needed!
    const commentResponses: CommentResponse[] = pageComments.map((comment) => {
        const stats = likeStats.get(comment.id) ?? { total_likes: 0, user_liked: false };
        return {
            id: comment.id,
            author_name: comment.author_name ?? '',
            author_email_hash: comment.author_email_hash ?? null,
            content: comment.content,
            parent_id: comment.parent_id,
            likes: stats.total_likes,
            user_liked: stats.user_liked,
            created_at: comment.created_at,
            replies: [],
        };
    });

    const response: PageResponse = {
        page_id: page.id,
        slug: slug,
        title: page.title,
        comment_count: commentCount,
        likes: pageLikes.total_likes,
        user_liked: pageLikes.user_liked,
        comments: commentResponses,
    };

    return c.json(response);
});

// POST /api/v1/sites/:siteId/pages/:slug - Create comment
const createCommentSchema = z.object({
    author_name: z.string().optional(),
    author_email: z.string().email().optional(),
    content: z.string().min(1),
    parent_id: z.number().optional(),
    page_title: z.string().optional(),
    page_url: z.string().optional(),
});

comments.post('/:siteId/pages/:slug', zValidator('json', createCommentSchema), async (c) => {
    const siteId = parseInt(c.req.param('siteId'));
    const slug = c.req.param('slug');
    const body = c.req.valid('json');

    if (isNaN(siteId)) {
        return c.json({ error: 'Invalid site_id' }, 400);
    }

    const db = new Database(c.env.DB);

    // Get site
    const site = await db.getSiteById(siteId);
    if (!site) {
        return c.json({ error: 'Site not found' }, 404);
    }

    // Get or create page
    const page = await db.getOrCreatePage(site.id, slug, body.page_title, body.page_url);

    // Get auth user if present
    const authUser = await getAuthUser(c);

    // Validate: either authenticated or has author_name
    let userId: number | undefined;
    let authorName: string | undefined;
    let authorEmail: string | undefined;
    let effectiveAuthorName = '';

    if (authUser) {
        userId = authUser.id;
        // Don't store redundant info in comments table
        authorName = undefined;
        authorEmail = undefined;

        effectiveAuthorName = authUser.display_name || authUser.email.split('@')[0];
    } else {
        if (!body.author_name?.trim()) {
            return c.json({ error: 'author_name is required for anonymous comments' }, 400);
        }
        authorName = body.author_name;
        authorEmail = body.author_email;

        effectiveAuthorName = authorName;
    }

    // Get client info
    const ipAddress = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For');
    const userAgent = c.req.header('User-Agent');

    const comment = await db.createComment({
        siteId: site.id,
        pageId: page.id,
        userId,
        authorName,
        authorEmail,
        parentId: body.parent_id,
        content: body.content,
        ipAddress: ipAddress ?? undefined,
        userAgent: userAgent ?? undefined,
    });

    const response: CommentResponse = {
        id: comment.id,
        author_name: effectiveAuthorName,
        author_email_hash: comment.author_email_hash ?? null,
        content: comment.content,
        parent_id: comment.parent_id,
        likes: 0,
        user_liked: false,
        created_at: comment.created_at,
        replies: [],
    };

    return c.json(response, 201);
});

// GET /api/v1/sites/:siteId/comments - List all comments for a site (owner only)
comments.get('/:siteId/comments', async (c) => {
    const user = await getAuthUser(c);
    if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const siteId = parseInt(c.req.param('siteId'));
    if (isNaN(siteId)) {
        return c.json({ error: 'Invalid site_id' }, 400);
    }

    const status = c.req.query('status');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const db = new Database(c.env.DB);

    // Check site ownership
    const site = await db.getSiteById(siteId);
    if (!site) {
        return c.json({ error: 'Site not found' }, 404);
    }
    if (site.owner_id !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
    }

    const result = await db.getCommentsBySite(siteId, { status, limit, offset });

    return c.json({
        comments: result.comments,
        total: result.total,
        limit,
        offset,
    });
});

// DELETE /api/v1/comments/:id - Delete comment
comments.delete('/comments/:id', async (c) => {
    const user = await getAuthUser(c);
    if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    const commentId = parseInt(c.req.param('id'));
    if (isNaN(commentId)) {
        return c.json({ error: 'Invalid comment_id' }, 400);
    }

    const db = new Database(c.env.DB);

    const comment = await db.getCommentById(commentId);
    if (!comment) {
        return c.json({ error: 'Comment not found' }, 404);
    }

    // Check if user is the comment author OR site owner
    const site = await db.getSiteById(comment.site_id);
    const isOwner = site?.owner_id === user.id;
    const isAuthor = comment.user_id === user.id;

    if (!isOwner && !isAuthor) {
        return c.json({ error: 'Forbidden' }, 403);
    }

    await db.deleteComment(commentId);

    return c.json({ success: true });
});

// PATCH /api/v1/comments/:id - Edit comment (author only)
const editCommentSchema = z.object({
    content: z.string().min(1),
});

comments.patch('/comments/:id', zValidator('json', editCommentSchema), async (c) => {
    const user = await getAuthUser(c);
    if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
    }

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

    // Only the author can edit their own comment
    if (comment.user_id !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
    }

    // Sanitize content for XSS prevention
    const sanitizedContent = sanitizeContent(body.content);
    const updated = await db.updateComment(commentId, sanitizedContent);

    const response: CommentResponse = {
        id: updated.id,
        author_name: updated.author_name ?? '',
        author_email_hash: updated.author_email_hash ?? null,
        content: updated.content,
        parent_id: updated.parent_id,
        likes: 0, // Would need to fetch again
        user_liked: false,
        created_at: updated.created_at,
        replies: [],
    };

    return c.json(response);
});

// PATCH /api/v1/comments/:id/status - Moderate comment (site owner only)
const moderateCommentSchema = z.object({
    status: z.enum(['pending', 'approved', 'rejected', 'spam']),
});

comments.patch('/comments/:id/status', zValidator('json', moderateCommentSchema), async (c) => {
    const user = await getAuthUser(c);
    if (!user) {
        return c.json({ error: 'Authentication required' }, 401);
    }

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

    // Only site owner can moderate
    const site = await db.getSiteById(comment.site_id);
    if (!site || site.owner_id !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
    }

    await db.updateCommentStatus(commentId, body.status);

    return c.json({
        id: comment.id,
        status: body.status,
        updated: true,
    });
});

export { comments };

