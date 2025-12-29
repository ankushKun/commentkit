import type { Comment, LikeStats, Page, Site, User } from '../types';

// Database wrapper for D1 operations
export class Database {
    constructor(private db: D1Database) { }

    // ==========================================
    // Site queries
    // ==========================================

    async getSiteById(id: number): Promise<Site | null> {
        return this.db.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first<Site>();
    }

    async getSiteByApiKey(apiKey: string): Promise<Site | null> {
        return this.db.prepare('SELECT * FROM sites WHERE api_key = ?').bind(apiKey).first<Site>();
    }

    async getSitesByOwner(ownerId: number): Promise<Site[]> {
        const result = await this.db.prepare('SELECT * FROM sites WHERE owner_id = ?').bind(ownerId).all<Site>();
        return result.results;
    }

    async createSite(name: string, domain: string, apiKey: string, ownerId: number): Promise<Site> {
        const result = await this.db
            .prepare('INSERT INTO sites (name, domain, api_key, owner_id) VALUES (?, ?, ?, ?) RETURNING *')
            .bind(name, domain, apiKey, ownerId)
            .first<Site>();
        if (!result) throw new Error('Failed to create site');
        return result;
    }

    async deleteSite(id: number): Promise<void> {
        await this.db.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
    }

    async getSiteByDomain(domain: string): Promise<Site | null> {
        return this.db.prepare('SELECT * FROM sites WHERE domain = ?').bind(domain).first<Site>();
    }

    async updateSite(
        id: number,
        updates: { name?: string; domain?: string; settings?: string }
    ): Promise<Site> {
        const setClauses: string[] = [];
        const values: (string | number)[] = [];

        if (updates.name !== undefined) {
            setClauses.push('name = ?');
            values.push(updates.name);
        }
        if (updates.domain !== undefined) {
            setClauses.push('domain = ?');
            values.push(updates.domain);
        }
        if (updates.settings !== undefined) {
            setClauses.push('settings = ?');
            values.push(updates.settings);
        }

        if (setClauses.length === 0) {
            const site = await this.getSiteById(id);
            if (!site) throw new Error('Site not found');
            return site;
        }

        setClauses.push("updated_at = datetime('now')");
        values.push(id);

        const result = await this.db
            .prepare(`UPDATE sites SET ${setClauses.join(', ')} WHERE id = ? RETURNING *`)
            .bind(...values)
            .first<Site>();

        if (!result) throw new Error('Failed to update site');
        return result;
    }

    async updateSiteApiKey(id: number, apiKey: string): Promise<void> {
        await this.db
            .prepare("UPDATE sites SET api_key = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(apiKey, id)
            .run();
    }

    async getSiteStats(siteId: number): Promise<{
        total_pages: number;
        total_comments: number;
        pending_comments: number;
        total_likes: number;
    }> {
        const pagesResult = await this.db
            .prepare('SELECT COUNT(*) as count FROM pages WHERE site_id = ?')
            .bind(siteId)
            .first<{ count: number }>();

        const commentsResult = await this.db
            .prepare('SELECT COUNT(*) as count FROM comments WHERE site_id = ?')
            .bind(siteId)
            .first<{ count: number }>();

        const pendingResult = await this.db
            .prepare("SELECT COUNT(*) as count FROM comments WHERE site_id = ? AND status = 'pending'")
            .bind(siteId)
            .first<{ count: number }>();

        const likesResult = await this.db
            .prepare(
                `SELECT COUNT(*) as count FROM page_likes pl
                 JOIN pages p ON pl.page_id = p.id
                 WHERE p.site_id = ?`
            )
            .bind(siteId)
            .first<{ count: number }>();

        return {
            total_pages: pagesResult?.count ?? 0,
            total_comments: commentsResult?.count ?? 0,
            pending_comments: pendingResult?.count ?? 0,
            total_likes: likesResult?.count ?? 0,
        };
    }

    // ==========================================
    // Page queries
    // ==========================================

    async getPageBySlug(siteId: number, slug: string): Promise<Page | null> {
        return this.db
            .prepare('SELECT * FROM pages WHERE site_id = ? AND slug = ?')
            .bind(siteId, slug)
            .first<Page>();
    }

    async getOrCreatePage(siteId: number, slug: string, title?: string, url?: string): Promise<Page> {
        const existing = await this.getPageBySlug(siteId, slug);
        if (existing) return existing;

        const result = await this.db
            .prepare('INSERT INTO pages (site_id, slug, title, url) VALUES (?, ?, ?, ?) RETURNING *')
            .bind(siteId, slug, title ?? null, url ?? null)
            .first<Page>();
        if (!result) throw new Error('Failed to create page');
        return result;
    }

    // ==========================================
    // User queries
    // ==========================================

    async getUserById(id: number): Promise<User | null> {
        return this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>();
    }

    async getUserByEmail(email: string): Promise<User | null> {
        return this.db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<User>();
    }

    async createUser(email: string, displayName?: string): Promise<User> {
        const result = await this.db
            .prepare('INSERT INTO users (email, display_name) VALUES (?, ?) RETURNING *')
            .bind(email, displayName ?? null)
            .first<User>();
        if (!result) throw new Error('Failed to create user');
        return result;
    }

    async getOrCreateUser(email: string): Promise<User> {
        const existing = await this.getUserByEmail(email);
        if (existing) return existing;
        return this.createUser(email);
    }

    async updateUserProfile(
        userId: number,
        data: { display_name?: string }
    ): Promise<void> {
        await this.db
            .prepare('UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .bind(data.display_name ?? null, userId)
            .run();
    }

    // ==========================================
    // Comment queries
    // ==========================================

    async getCommentsByPage(pageId: number): Promise<Comment[]> {
        const result = await this.db
            .prepare("SELECT * FROM comments WHERE page_id = ? AND status = 'approved' ORDER BY created_at ASC")
            .bind(pageId)
            .all<Comment>();
        return result.results;
    }

    async getCommentById(id: number): Promise<Comment | null> {
        return this.db.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first<Comment>();
    }

    async createComment(params: {
        siteId: number;
        pageId: number;
        userId?: number;
        authorName?: string;
        authorEmail?: string;
        parentId?: number;
        content: string;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<Comment> {
        const status = params.userId ? 'approved' : 'pending';

        const result = await this.db
            .prepare(
                `INSERT INTO comments (site_id, page_id, user_id, author_name, author_email, parent_id, content, status, ip_address, user_agent) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
            )
            .bind(
                params.siteId,
                params.pageId,
                params.userId ?? null,
                params.authorName ?? null,
                params.authorEmail ?? null,
                params.parentId ?? null,
                params.content,
                status,
                params.ipAddress ?? null,
                params.userAgent ?? null
            )
            .first<Comment>();

        if (!result) throw new Error('Failed to create comment');
        return result;
    }

    async deleteComment(id: number): Promise<void> {
        await this.db.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
    }

    async updateCommentStatus(id: number, status: string): Promise<void> {
        await this.db
            .prepare("UPDATE comments SET status = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(status, id)
            .run();
    }

    async getCommentCount(pageId: number): Promise<number> {
        const result = await this.db
            .prepare("SELECT COUNT(*) as count FROM comments WHERE page_id = ? AND status = 'approved'")
            .bind(pageId)
            .first<{ count: number }>();
        return result?.count ?? 0;
    }

    async getCommentsBySite(
        siteId: number,
        options: { status?: string; limit?: number; offset?: number } = {}
    ): Promise<{ comments: Comment[]; total: number }> {
        const { status, limit = 50, offset = 0 } = options;

        let countQuery = 'SELECT COUNT(*) as count FROM comments WHERE site_id = ?';
        let dataQuery = 'SELECT * FROM comments WHERE site_id = ?';

        if (status) {
            countQuery += ' AND status = ?';
            dataQuery += ' AND status = ?';
        }

        dataQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

        const countResult = status
            ? await this.db.prepare(countQuery).bind(siteId, status).first<{ count: number }>()
            : await this.db.prepare(countQuery).bind(siteId).first<{ count: number }>();

        const dataResult = status
            ? await this.db.prepare(dataQuery).bind(siteId, status, limit, offset).all<Comment>()
            : await this.db.prepare(dataQuery).bind(siteId, limit, offset).all<Comment>();

        return {
            comments: dataResult.results,
            total: countResult?.count ?? 0,
        };
    }

    async updateComment(id: number, content: string): Promise<Comment> {
        const result = await this.db
            .prepare(
                "UPDATE comments SET content = ?, is_edited = 1, updated_at = datetime('now') WHERE id = ? RETURNING *"
            )
            .bind(content, id)
            .first<Comment>();

        if (!result) throw new Error('Failed to update comment');
        return result;
    }

    // ==========================================
    // Page Likes queries
    // ==========================================

    async addPageLike(pageId: number, userId: number): Promise<void> {
        await this.db
            .prepare('INSERT OR IGNORE INTO page_likes (page_id, user_id) VALUES (?, ?)')
            .bind(pageId, userId)
            .run();
    }

    async removePageLike(pageId: number, userId: number): Promise<void> {
        await this.db
            .prepare('DELETE FROM page_likes WHERE page_id = ? AND user_id = ?')
            .bind(pageId, userId)
            .run();
    }

    async getPageLikeStats(pageId: number, userId?: number): Promise<LikeStats> {
        const countResult = await this.db
            .prepare('SELECT COUNT(*) as count FROM page_likes WHERE page_id = ?')
            .bind(pageId)
            .first<{ count: number }>();

        const totalLikes = countResult?.count ?? 0;

        let userLiked = false;
        if (userId) {
            const liked = await this.db
                .prepare('SELECT 1 FROM page_likes WHERE page_id = ? AND user_id = ? LIMIT 1')
                .bind(pageId, userId)
                .first();
            userLiked = !!liked;
        }

        return { total_likes: totalLikes, user_liked: userLiked };
    }

    // ==========================================
    // Comment Likes (reactions) queries
    // ==========================================

    async addCommentLike(commentId: number, userId: number): Promise<void> {
        await this.db
            .prepare(
                `INSERT INTO reactions (comment_id, user_id, reaction) VALUES (?, ?, 'like')
         ON CONFLICT(comment_id, user_id) DO UPDATE SET reaction = 'like'`
            )
            .bind(commentId, userId)
            .run();
    }

    async removeCommentLike(commentId: number, userId: number): Promise<void> {
        await this.db
            .prepare('DELETE FROM reactions WHERE comment_id = ? AND user_id = ?')
            .bind(commentId, userId)
            .run();
    }

    async getCommentLikeStats(commentId: number, userId?: number): Promise<LikeStats> {
        const countResult = await this.db
            .prepare("SELECT COUNT(*) as count FROM reactions WHERE comment_id = ? AND reaction = 'like'")
            .bind(commentId)
            .first<{ count: number }>();

        const totalLikes = countResult?.count ?? 0;

        let userLiked = false;
        if (userId) {
            const liked = await this.db
                .prepare("SELECT 1 FROM reactions WHERE comment_id = ? AND user_id = ? AND reaction = 'like' LIMIT 1")
                .bind(commentId, userId)
                .first();
            userLiked = !!liked;
        }

        return { total_likes: totalLikes, user_liked: userLiked };
    }

    async getCommentLikeStatsBatch(commentIds: number[], userId?: number): Promise<Map<number, LikeStats>> {
        const result = new Map<number, LikeStats>();

        // Initialize all with zero
        for (const id of commentIds) {
            result.set(id, { total_likes: 0, user_liked: false });
        }

        if (commentIds.length === 0) return result;

        // Query each one (D1 doesn't support array parameters well)
        for (const commentId of commentIds) {
            const stats = await this.getCommentLikeStats(commentId, userId);
            result.set(commentId, stats);
        }

        return result;
    }

    // ==========================================
    // Auth queries
    // ==========================================

    async createMagicLink(email: string, token: string, expiresAt: string): Promise<void> {
        await this.db
            .prepare('INSERT INTO magic_links (email, token, expires_at) VALUES (?, ?, ?)')
            .bind(email, token, expiresAt)
            .run();
    }

    async verifyMagicLink(token: string): Promise<string | null> {
        const result = await this.db
            .prepare("SELECT email FROM magic_links WHERE token = ? AND used = 0 AND expires_at > datetime('now')")
            .bind(token)
            .first<{ email: string }>();

        if (result) {
            await this.db.prepare('UPDATE magic_links SET used = 1 WHERE token = ?').bind(token).run();
        }

        return result?.email ?? null;
    }

    async createSession(userId: number, tokenHash: string, expiresAt: string): Promise<void> {
        await this.db
            .prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)')
            .bind(userId, tokenHash, expiresAt)
            .run();
    }

    async getSessionUser(tokenHash: string): Promise<User | null> {
        return this.db
            .prepare(
                `SELECT u.* FROM users u 
         JOIN sessions s ON u.id = s.user_id 
         WHERE s.token_hash = ? AND s.expires_at > datetime('now')`
            )
            .bind(tokenHash)
            .first<User>();
    }

    async deleteSession(tokenHash: string): Promise<void> {
        await this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    }

    // ==========================================
    // Admin queries - Global Analytics
    // ==========================================

    async getGlobalStats(): Promise<{
        total_users: number;
        total_sites: number;
        total_pages: number;
        total_comments: number;
        pending_comments: number;
        total_page_likes: number;
        total_comment_likes: number;
    }> {
        const [users, sites, pages, comments, pending, pageLikes, commentLikes] = await Promise.all([
            this.db.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>(),
            this.db.prepare('SELECT COUNT(*) as count FROM sites').first<{ count: number }>(),
            this.db.prepare('SELECT COUNT(*) as count FROM pages').first<{ count: number }>(),
            this.db.prepare('SELECT COUNT(*) as count FROM comments').first<{ count: number }>(),
            this.db.prepare("SELECT COUNT(*) as count FROM comments WHERE status = 'pending'").first<{ count: number }>(),
            this.db.prepare('SELECT COUNT(*) as count FROM page_likes').first<{ count: number }>(),
            this.db.prepare('SELECT COUNT(*) as count FROM reactions').first<{ count: number }>(),
        ]);

        return {
            total_users: users?.count ?? 0,
            total_sites: sites?.count ?? 0,
            total_pages: pages?.count ?? 0,
            total_comments: comments?.count ?? 0,
            pending_comments: pending?.count ?? 0,
            total_page_likes: pageLikes?.count ?? 0,
            total_comment_likes: commentLikes?.count ?? 0,
        };
    }

    async getRecentActivity(limit: number = 10): Promise<{
        recent_users: User[];
        recent_sites: Site[];
        recent_comments: Comment[];
    }> {
        const [users, sites, comments] = await Promise.all([
            this.db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ?').bind(limit).all<User>(),
            this.db.prepare('SELECT * FROM sites ORDER BY created_at DESC LIMIT ?').bind(limit).all<Site>(),
            this.db.prepare('SELECT * FROM comments ORDER BY created_at DESC LIMIT ?').bind(limit).all<Comment>(),
        ]);

        return {
            recent_users: users.results,
            recent_sites: sites.results,
            recent_comments: comments.results,
        };
    }

    // ==========================================
    // Admin queries - User Management
    // ==========================================

    async getAllUsers(options: { limit?: number; offset?: number; search?: string } = {}): Promise<{
        users: User[];
        total: number;
    }> {
        const { limit = 50, offset = 0, search } = options;

        let countQuery = 'SELECT COUNT(*) as count FROM users';
        let dataQuery = 'SELECT * FROM users';

        if (search) {
            const searchCondition = " WHERE email LIKE ? OR display_name LIKE ?";
            countQuery += searchCondition;
            dataQuery += searchCondition;
        }

        dataQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

        const searchPattern = search ? `%${search}%` : null;

        const countResult = search
            ? await this.db.prepare(countQuery).bind(searchPattern, searchPattern).first<{ count: number }>()
            : await this.db.prepare(countQuery).first<{ count: number }>();

        const dataResult = search
            ? await this.db.prepare(dataQuery).bind(searchPattern, searchPattern, limit, offset).all<User>()
            : await this.db.prepare(dataQuery).bind(limit, offset).all<User>();

        return {
            users: dataResult.results,
            total: countResult?.count ?? 0,
        };
    }

    async setUserSuperadmin(userId: number, isSuperadmin: boolean): Promise<void> {
        await this.db
            .prepare("UPDATE users SET is_superadmin = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(isSuperadmin ? 1 : 0, userId)
            .run();
    }

    async deleteUser(userId: number): Promise<void> {
        await this.db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
    }

    async getUserWithStats(userId: number): Promise<{
        user: User | null;
        stats: { sites_owned: number; comments_made: number; total_likes_given: number };
    }> {
        const user = await this.getUserById(userId);
        if (!user) {
            return { user: null, stats: { sites_owned: 0, comments_made: 0, total_likes_given: 0 } };
        }

        const [sites, comments, likes] = await Promise.all([
            this.db.prepare('SELECT COUNT(*) as count FROM sites WHERE owner_id = ?').bind(userId).first<{ count: number }>(),
            this.db.prepare('SELECT COUNT(*) as count FROM comments WHERE user_id = ?').bind(userId).first<{ count: number }>(),
            this.db.prepare(
                `SELECT COUNT(*) as count FROM (
                    SELECT id FROM page_likes WHERE user_id = ?
                    UNION ALL
                    SELECT id FROM reactions WHERE user_id = ?
                )`
            ).bind(userId, userId).first<{ count: number }>(),
        ]);

        return {
            user,
            stats: {
                sites_owned: sites?.count ?? 0,
                comments_made: comments?.count ?? 0,
                total_likes_given: likes?.count ?? 0,
            },
        };
    }

    // ==========================================
    // Admin queries - Site Management
    // ==========================================

    async getAllSites(options: { limit?: number; offset?: number; search?: string } = {}): Promise<{
        sites: (Site & { owner_email?: string })[];
        total: number;
    }> {
        const { limit = 50, offset = 0, search } = options;

        let countQuery = 'SELECT COUNT(*) as count FROM sites';
        let dataQuery = `
            SELECT s.*, u.email as owner_email 
            FROM sites s 
            LEFT JOIN users u ON s.owner_id = u.id
        `;

        if (search) {
            const searchCondition = " WHERE s.name LIKE ? OR s.domain LIKE ?";
            countQuery = 'SELECT COUNT(*) as count FROM sites s' + searchCondition;
            dataQuery += searchCondition;
        }

        dataQuery += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';

        const searchPattern = search ? `%${search}%` : null;

        const countResult = search
            ? await this.db.prepare(countQuery).bind(searchPattern, searchPattern).first<{ count: number }>()
            : await this.db.prepare(countQuery).first<{ count: number }>();

        const dataResult = search
            ? await this.db.prepare(dataQuery).bind(searchPattern, searchPattern, limit, offset).all<Site & { owner_email?: string }>()
            : await this.db.prepare(dataQuery).bind(limit, offset).all<Site & { owner_email?: string }>();

        return {
            sites: dataResult.results,
            total: countResult?.count ?? 0,
        };
    }

    async transferSiteOwnership(siteId: number, newOwnerId: number): Promise<void> {
        await this.db
            .prepare("UPDATE sites SET owner_id = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(newOwnerId, siteId)
            .run();
    }

    // ==========================================
    // Admin queries - Comment Management
    // ==========================================

    async getAllComments(options: {
        limit?: number;
        offset?: number;
        status?: string;
        siteId?: number;
    } = {}): Promise<{
        comments: (Comment & { page_slug?: string; site_domain?: string })[];
        total: number;
    }> {
        const { limit = 50, offset = 0, status, siteId } = options;

        const conditions: string[] = [];
        const params: (string | number)[] = [];

        if (status) {
            conditions.push('c.status = ?');
            params.push(status);
        }
        if (siteId) {
            conditions.push('c.site_id = ?');
            params.push(siteId);
        }

        const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

        const countQuery = `SELECT COUNT(*) as count FROM comments c${whereClause}`;
        const dataQuery = `
            SELECT c.*, p.slug as page_slug, s.domain as site_domain
            FROM comments c
            LEFT JOIN pages p ON c.page_id = p.id
            LEFT JOIN sites s ON c.site_id = s.id
            ${whereClause}
            ORDER BY c.created_at DESC LIMIT ? OFFSET ?
        `;

        const countResult = await this.db.prepare(countQuery).bind(...params).first<{ count: number }>();
        const dataResult = await this.db
            .prepare(dataQuery)
            .bind(...params, limit, offset)
            .all<Comment & { page_slug?: string; site_domain?: string }>();

        return {
            comments: dataResult.results,
            total: countResult?.count ?? 0,
        };
    }

    async bulkUpdateCommentStatus(commentIds: number[], status: string): Promise<number> {
        let updated = 0;
        for (const id of commentIds) {
            await this.updateCommentStatus(id, status);
            updated++;
        }
        return updated;
    }

    async bulkDeleteComments(commentIds: number[]): Promise<number> {
        let deleted = 0;
        for (const id of commentIds) {
            await this.deleteComment(id);
            deleted++;
        }
        return deleted;
    }
}

