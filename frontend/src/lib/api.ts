// API client for Thread Engine

// Detect environment and set API base URL accordingly
const isLocalhost = () => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;
    return hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.endsWith('.local');
};

const API_BASE = isLocalhost()
    ? 'http://localhost:8787'  // Local development
    : 'https://commentkit.ankushkun.workers.dev';  // Production

interface ApiResponse<T> {
    data: T | null;
    error: string | null;
    status: number;
}

async function request<T>(
    path: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> {
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            ...options,
            credentials: 'include', // Include HttpOnly cookies for authentication
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
            return {
                data: null,
                error: json?.error || `Request failed with status ${res.status}`,
                status: res.status,
            };
        }

        return { data: json as T, error: null, status: res.status };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : 'Network error',
            status: 0,
        };
    }
}

// Bootstrap data type (returned with /auth/me?bootstrap=true)
export interface BootstrapData {
    sites: SitePreviewWithStats[];
    aggregated: SiteStats;
}

export interface UserWithBootstrap extends User {
    bootstrap?: BootstrapData;
}

// Auth
export const auth = {
    login: (email: string) =>
        request<{ message: string }>('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),

    verify: (token: string) =>
        request<{ token: string; user: User }>(`/api/v1/auth/verify?token=${token}`),

    // Get current user, optionally with bootstrap data to save an extra API call
    me: (options?: { bootstrap?: boolean }) =>
        request<UserWithBootstrap>(`/api/v1/auth/me${options?.bootstrap ? '?bootstrap=true' : ''}`),

    logout: () =>
        request<{ message: string }>('/api/v1/auth/logout', { method: 'POST' }),

    updateProfile: (data: { display_name?: string }) =>
        request<User>('/api/v1/auth/profile', {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
};

// Sites (user's own sites)
export const sites = {
    list: () => request<{ sites: SitePreview[] }>('/api/v1/admin/sites'),

    // Optimized: Get all sites with stats in a single call (for dashboard overview)
    overview: () => request<{
        sites: SitePreviewWithStats[];
        aggregated: SiteStats;
    }>('/api/v1/admin/sites/overview'),

    // Optimized: Get site with stats and comments in a single call
    get: (id: number, params?: { comment_status?: string; comment_limit?: number; comment_offset?: number }) => {
        const query = new URLSearchParams();
        if (params?.comment_status) query.set('comment_status', params.comment_status);
        if (params?.comment_limit) query.set('comment_limit', String(params.comment_limit));
        if (params?.comment_offset) query.set('comment_offset', String(params.comment_offset));
        const queryStr = query.toString();
        return request<SiteDetailWithData>(`/api/v1/admin/sites/${id}${queryStr ? `?${queryStr}` : ''}`);
    },

    create: (name: string, domain: string) =>
        request<Site>('/api/v1/admin/sites', {
            method: 'POST',
            body: JSON.stringify({ name, domain }),
        }),

    update: (id: number, data: { name?: string; domain?: string }) =>
        request<Site>(`/api/v1/admin/sites/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),

    delete: (id: number) =>
        request<{ success: boolean }>(`/api/v1/admin/sites/${id}`, {
            method: 'DELETE',
        }),

    regenerateKey: (id: number) =>
        request<{ api_key: string }>(`/api/v1/admin/sites/${id}/regenerate-key`, {
            method: 'POST',
        }),

    // Get pages for a site with comment counts
    getPages: (siteId: number, params?: {
        limit?: number;
        offset?: number;
        search?: string;
        sort?: string;
        order?: string;
    }) => {
        const query = new URLSearchParams();
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.offset) query.set('offset', String(params.offset));
        if (params?.search) query.set('search', params.search);
        if (params?.sort) query.set('sort', params.sort);
        if (params?.order) query.set('order', params.order);
        const queryStr = query.toString();
        return request<{ pages: PageWithStats[]; total: number; limit: number; offset: number }>(
            `/api/v1/admin/sites/${siteId}/pages${queryStr ? `?${queryStr}` : ''}`
        );
    },

    // Get activity for a site
    getActivity: (siteId: number, limit?: number) =>
        request<{ activity: ActivityItem[] }>(
            `/api/v1/admin/sites/${siteId}/activity${limit ? `?limit=${limit}` : ''}`
        ),

    // Get analytics for a site
    getAnalytics: (siteId: number, period?: string) =>
        request<AnalyticsData>(
            `/api/v1/admin/sites/${siteId}/analytics${period ? `?period=${period}` : ''}`
        ),

    // Bulk moderate comments
    bulkModerate: (siteId: number, commentIds: number[], action: 'approve' | 'reject' | 'spam' | 'delete') =>
        request<{ processed: number; action: string }>(
            `/api/v1/admin/sites/${siteId}/comments/bulk`,
            {
                method: 'POST',
                body: JSON.stringify({ comment_ids: commentIds, action }),
            }
        ),

    // Get verification token and instructions
    getVerification: (id: number) =>
        request<VerificationInfo>(`/api/v1/admin/sites/${id}/verification`),

    // Trigger verification check
    verify: (id: number) =>
        request<VerificationResult>(`/api/v1/admin/sites/${id}/verify`, {
            method: 'POST',
        }),
};

// Comments management
export const comments = {
    updateStatus: (id: number, status: 'pending' | 'approved' | 'rejected' | 'spam') =>
        request<{ id: number; status: string; updated: boolean }>(
            `/api/v1/sites/comments/${id}/status`,
            {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            }
        ),

    update: (id: number, content: string) =>
        request<Comment>(`/api/v1/sites/comments/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ content }),
        }),

    delete: (id: number) =>
        request<{ success: boolean }>(`/api/v1/sites/comments/${id}`, {
            method: 'DELETE',
        }),
};

// Superadmin (admin-only endpoints)
export const superadmin = {
    stats: () => request<GlobalStats>('/api/v1/superadmin/stats'),

    activity: (limit = 10) =>
        request<RecentActivity>(`/api/v1/superadmin/activity?limit=${limit}`),

    users: (params?: { limit?: number; offset?: number; search?: string }) => {
        const query = new URLSearchParams();
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.offset) query.set('offset', String(params.offset));
        if (params?.search) query.set('search', params.search);
        return request<{ users: AdminUser[]; total: number; limit: number; offset: number }>(
            `/api/v1/superadmin/users?${query}`
        );
    },

    getUser: (id: number) =>
        request<{ user: AdminUser; stats: UserStats }>(`/api/v1/superadmin/users/${id}`),

    setUserSuperadmin: (id: number, is_superadmin: boolean) =>
        request<{ id: number; is_superadmin: boolean; updated: boolean }>(
            `/api/v1/superadmin/users/${id}/admin`,
            { method: 'PATCH', body: JSON.stringify({ is_superadmin }) }
        ),

    deleteUser: (id: number) =>
        request<{ success: boolean }>(`/api/v1/superadmin/users/${id}`, { method: 'DELETE' }),

    sites: (params?: { limit?: number; offset?: number; search?: string }) => {
        const query = new URLSearchParams();
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.offset) query.set('offset', String(params.offset));
        if (params?.search) query.set('search', params.search);
        return request<{ sites: AdminSite[]; total: number; limit: number; offset: number }>(
            `/api/v1/superadmin/sites?${query}`
        );
    },

    getSite: (id: number) =>
        request<{ site: AdminSiteDetail; stats: SiteStats }>(`/api/v1/superadmin/sites/${id}`),

    deleteSite: (id: number) =>
        request<{ success: boolean }>(`/api/v1/superadmin/sites/${id}`, { method: 'DELETE' }),

    comments: (params?: { limit?: number; offset?: number; status?: string; site_id?: number }) => {
        const query = new URLSearchParams();
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.offset) query.set('offset', String(params.offset));
        if (params?.status) query.set('status', params.status);
        if (params?.site_id) query.set('site_id', String(params.site_id));
        return request<{ comments: Comment[]; total: number; limit: number; offset: number }>(
            `/api/v1/superadmin/comments?${query}`
        );
    },

    updateCommentStatus: (id: number, status: 'pending' | 'approved' | 'rejected' | 'spam') =>
        request<{ id: number; status: string; updated: boolean }>(
            `/api/v1/superadmin/comments/${id}/status`,
            { method: 'PATCH', body: JSON.stringify({ status }) }
        ),

    deleteComment: (id: number) =>
        request<{ success: boolean }>(`/api/v1/superadmin/comments/${id}`, { method: 'DELETE' }),
};

// Types
export interface User {
    id: number;
    email: string;
    email_hash: string | null;
    display_name: string | null;
    is_superadmin: boolean;
    created_at: string;
    updated_at: string;
}

export interface GlobalStats {
    total_users: number;
    total_sites: number;
    total_pages: number;
    total_comments: number;
    pending_comments: number;
    total_likes: number;
}

export interface RecentActivity {
    recent_users: AdminUser[];
    recent_sites: { id: number; name: string; domain: string; owner_id: number; created_at: string }[];
    recent_comments: { id: number; content: string; status: string; author_name: string | null; site_id: number; created_at: string }[];
}

export interface AdminUser {
    id: number;
    email: string;
    display_name: string | null;
    email_verified: boolean;
    is_superadmin: boolean;
    created_at: string;
    updated_at: string;
}

export interface UserStats {
    sites_owned: number;
    comments_made: number;
}

export interface AdminSite {
    id: number;
    name: string;
    domain: string;
    owner_id: number;
    owner_email: string;
    created_at: string;
    updated_at: string;
}

export interface AdminSiteDetail {
    id: number;
    name: string;
    domain: string;
    api_key: string;
    settings: Record<string, unknown>;
    owner_id: number;
    owner_email: string;
    created_at: string;
    updated_at: string;
}

export interface SitePreview {
    id: number;
    name: string;
    domain: string;
    api_key_preview: string;
    verified: boolean;
    verified_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface SitePreviewWithStats extends SitePreview {
    stats: SiteStats;
}

export interface SiteDetail {
    id: number;
    name: string;
    domain: string;
    api_key: string;
    settings: Record<string, unknown>;
    verified: boolean;
    verified_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface SiteDetailWithData extends SiteDetail {
    stats: SiteStats;
    comments?: Comment[];
    comments_total?: number;
}

export interface Site {
    id: number;
    name: string;
    domain: string;
    api_key: string;
    verified: boolean;
    created_at: string;
}

export interface VerificationInfo {
    verified: boolean;
    verified_at: string | null;
    verification_token: string;
    verification_file_path: string;
    verification_file_content: string;
    verification_url: string;
}

export interface VerificationResult {
    verified: boolean;
    message?: string;
    error?: string;
}

export interface SiteStats {
    total_pages: number;
    total_comments: number;
    pending_comments: number;
    total_likes: number;
}

export interface Comment {
    id: number;
    site_id: number;
    page_id: number;
    user_id: number | null;
    author_name: string | null;
    author_email: string | null;
    author_email_hash: string | null;
    content: string;
    status: 'pending' | 'approved' | 'rejected' | 'spam';
    created_at: string;
    updated_at: string;
}

// Dashboard types
export interface PageWithStats {
    id: number;
    site_id: number;
    slug: string;
    title: string | null;
    url: string | null;
    comment_count: number;
    pending_count: number;
    latest_comment_at: string | null;
    created_at: string;
}

export interface ActivityItem {
    id: number;
    type: 'comment' | 'reply';
    author_name: string | null;
    author_email_hash: string | null;
    content: string;
    page_title: string | null;
    page_slug: string;
    status: string;
    created_at: string;
}

export interface AnalyticsData {
    summary: {
        total_comments: number;
        approved: number;
        pending: number;
        spam: number;
        rejected: number;
    };
    daily_comments: { date: string; count: number; approved: number; pending: number }[];
    top_pages: { slug: string; title: string | null; comment_count: number }[];
    top_commenters: { author_name: string; comment_count: number }[];
}
