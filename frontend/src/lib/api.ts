// API client for Thread Engine

const API_BASE = 'http://localhost:8787';

interface ApiResponse<T> {
    data: T | null;
    error: string | null;
    status: number;
}

async function request<T>(
    path: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> {
    const token = localStorage.getItem('auth_token');

    try {
        const res = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

// Auth
export const auth = {
    login: (email: string) =>
        request<{ message: string }>('/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),

    verify: (token: string) =>
        request<{ token: string; user: User }>(`/api/v1/auth/verify?token=${token}`),

    me: () => request<User>('/api/v1/auth/me'),

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

    get: (id: number) => request<SiteDetail>(`/api/v1/admin/sites/${id}`),

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

    stats: (id: number) => request<SiteStats>(`/api/v1/admin/sites/${id}/stats`),

    comments: (id: number, params?: { status?: string; limit?: number; offset?: number }) => {
        const query = new URLSearchParams();
        if (params?.status) query.set('status', params.status);
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.offset) query.set('offset', String(params.offset));
        return request<{ comments: Comment[]; total: number }>(
            `/api/v1/sites/${id}/comments?${query}`
        );
    },
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
    display_name: string | null;
    is_superadmin: boolean;
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
    created_at: string;
    updated_at: string;
}

export interface SiteDetail {
    id: number;
    name: string;
    domain: string;
    api_key: string;
    settings: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface Site {
    id: number;
    name: string;
    domain: string;
    api_key: string;
    created_at: string;
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
    content: string;
    status: 'pending' | 'approved' | 'rejected' | 'spam';
    created_at: string;
    updated_at: string;
}
