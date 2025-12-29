-- CommentKit Schema for D1 (SQLite)
-- Multi-site commenting and discussion backend
-- Includes all optimizations for 10ms CPU limit

-- ============================================
-- SITES: Multi-site support
-- ============================================
CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  api_key TEXT NOT NULL UNIQUE,
  owner_id INTEGER,
  settings TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites(domain);
CREATE INDEX IF NOT EXISTS idx_sites_api_key ON sites(api_key);
CREATE INDEX IF NOT EXISTS idx_sites_owner ON sites(owner_id);

-- ============================================
-- PAGES: Page-scoped threads
-- ============================================
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT,
  url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pages_site_slug ON pages(site_id, slug);
CREATE INDEX IF NOT EXISTS idx_pages_site_id ON pages(site_id);

-- ============================================
-- USERS: Authenticated users (for likes, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  email_hash TEXT,
  display_name TEXT,
  avatar_url TEXT,
  is_superadmin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_superadmin ON users(is_superadmin);
CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash);

-- ============================================
-- MAGIC_LINKS: Passwordless authentication
-- ============================================
CREATE TABLE IF NOT EXISTS magic_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);
CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(email);
CREATE INDEX IF NOT EXISTS idx_magic_links_token_used ON magic_links(token, used, expires_at);

-- ============================================
-- SESSIONS: User sessions
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_expires ON sessions(token_hash, expires_at);

-- ============================================
-- COMMENTS: Threaded comments with moderation
-- ============================================
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT,
  author_email TEXT,
  author_email_hash TEXT,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'spam')),
  ip_address TEXT,
  user_agent TEXT,
  is_edited INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  CHECK (user_id IS NOT NULL OR author_name IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_comments_page_id ON comments(page_id);
CREATE INDEX IF NOT EXISTS idx_comments_site_id ON comments(site_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_site_status ON comments(site_id, status);
CREATE INDEX IF NOT EXISTS idx_comments_page_status ON comments(page_id, status);

-- ============================================
-- REACTIONS: Likes and other reactions on comments
-- ============================================
CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL DEFAULT 'like' CHECK (reaction IN ('like', 'love', 'laugh', 'sad', 'angry')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_unique ON reactions(comment_id, user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_comment_id ON reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_reactions_comment_user ON reactions(comment_id, user_id);

-- ============================================
-- PAGE_LIKES: Likes on pages (authenticated users only)
-- ============================================
CREATE TABLE IF NOT EXISTS page_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_page_likes_unique ON page_likes(page_id, user_id);
CREATE INDEX IF NOT EXISTS idx_page_likes_page_id ON page_likes(page_id);
CREATE INDEX IF NOT EXISTS idx_page_likes_user_id ON page_likes(user_id);

-- ============================================
-- MODERATION_LOG: Track moderation actions
-- ============================================
CREATE TABLE IF NOT EXISTS moderation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  reason TEXT,
  moderator_info TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_moderation_log_site_id ON moderation_log(site_id);
CREATE INDEX IF NOT EXISTS idx_moderation_log_comment_id ON moderation_log(comment_id);
