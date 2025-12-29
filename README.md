# CommentKit (Cloudflare Workers + D1)

A TypeScript-based Cloudflare Workers implementation of CommentKit, using Hono as the web framework and D1 (SQLite) for persistence.

## Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) CLI
- Cloudflare account

## Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Login to Cloudflare

```bash
bunx wrangler login
```

### 3. Create D1 Database

```bash
bunx wrangler d1 create commentkit-db
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "commentkit-db"
database_id = "YOUR_DATABASE_ID_HERE"  # <-- Replace this
```

### 4. Run Migrations

```bash
# Local development
bun run db:migrate:local

# Production
bun run db:migrate
```

### 5. Set Secrets

```bash
bunx wrangler secret put JWT_SECRET
bunx wrangler secret put RESEND_API_KEY  # Optional, for email
```

## Development

```bash
bun run dev
```

This starts a local server at `http://localhost:8787`.

## Deployment

```bash
bun run deploy
```

## Embedding CommentKit

### Simple Embed (Recommended)

Just add this to any page where you want comments:

```html
<div id="commentkit"></div>
<script src="https://your-frontend-url.com/commentkit.js"></script>
```

That's it! CommentKit will automatically:
- Detect your site by domain
- Use the current page URL as the identifier
- Load and display comments for that page

### Custom Page Identifier

If your URLs change but you want to keep the same comments, use a custom page ID:

```html
<div id="commentkit"></div>
<script src="https://your-frontend-url.com/commentkit.js" 
        data-page-id="my-custom-page-id">
</script>
```

### Advanced Configuration

For more control, use the configuration function:

```html
<div id="commentkit"></div>
<script>
  var commentkit_config = function () {
    this.page.identifier = 'unique-page-id';  // Custom identifier
    this.page.title = 'My Page Title';        // Page title
    this.page.url = 'https://example.com/page'; // Canonical URL
  };
</script>
<script src="https://your-frontend-url.com/commentkit.js"></script>
```

## API Endpoints

### Authentication
| Method | Endpoint              | Description             | Auth |
| ------ | --------------------- | ----------------------- | ---- |
| GET    | `/health`             | Health check            | No   |
| POST   | `/api/v1/auth/login`  | Send magic link         | No   |
| GET    | `/api/v1/auth/verify` | Verify magic link token | No   |
| GET    | `/api/v1/auth/me`     | Get current user        | Yes  |
| POST   | `/api/v1/auth/logout` | Logout                  | Yes  |

### Site Management (Admin)
| Method | Endpoint                                 | Description         | Auth |
| ------ | ---------------------------------------- | ------------------- | ---- |
| GET    | `/api/v1/admin/sites`                    | List user's sites   | Yes  |
| GET    | `/api/v1/admin/sites/:id`                | Get site details    | Yes  |
| POST   | `/api/v1/admin/sites`                    | Create new site     | Yes  |
| PATCH  | `/api/v1/admin/sites/:id`                | Update site         | Yes  |
| DELETE | `/api/v1/admin/sites/:id`                | Delete site         | Yes  |
| POST   | `/api/v1/admin/sites/:id/regenerate-key` | Regenerate API key  | Yes  |
| GET    | `/api/v1/admin/sites/:id/stats`          | Get site statistics | Yes  |

### Comments (Domain-Based)
| Method | Endpoint                            | Description                       | Auth     |
| ------ | ----------------------------------- | --------------------------------- | -------- |
| GET    | `/api/v1/sites/comments`            | Get comments by domain & pageId   | No       |
| POST   | `/api/v1/sites/comments`            | Create comment by domain & pageId | Optional |
| GET    | `/api/v1/sites/:id/comments`        | List all site comments (owner)    | Yes      |
| DELETE | `/api/v1/sites/comments/:id`        | Delete comment                    | Yes      |
| PATCH  | `/api/v1/sites/comments/:id`        | Edit comment                      | Yes      |
| PATCH  | `/api/v1/sites/comments/:id/status` | Moderate comment                  | Yes      |

**Domain-Based Comment Endpoints:**
- `GET /api/v1/sites/comments?domain=example.com&pageId=https://example.com/blog/post-1`
- `POST /api/v1/sites/comments` with body: `{ domain, pageId, content, author_name, ... }`

### Likes
| Method | Endpoint                     | Description       | Auth |
| ------ | ---------------------------- | ----------------- | ---- |
| GET    | `/api/v1/pages/:id/likes`    | Get page likes    | No   |
| POST   | `/api/v1/pages/:id/likes`    | Like page         | Yes  |
| DELETE | `/api/v1/pages/:id/likes`    | Unlike page       | Yes  |
| GET    | `/api/v1/comments/:id/likes` | Get comment likes | No   |
| POST   | `/api/v1/comments/:id/likes` | Like comment      | Yes  |
| DELETE | `/api/v1/comments/:id/likes` | Unlike comment    | Yes  |

### Superadmin - Analytics
| Method | Endpoint                      | Description               | Auth       |
| ------ | ----------------------------- | ------------------------- | ---------- |
| GET    | `/api/v1/superadmin/stats`    | Get global platform stats | Superadmin |
| GET    | `/api/v1/superadmin/activity` | Get recent activity       | Superadmin |

### Superadmin - User Management
| Method | Endpoint                             | Description           | Auth       |
| ------ | ------------------------------------ | --------------------- | ---------- |
| GET    | `/api/v1/superadmin/users`           | List all users        | Superadmin |
| GET    | `/api/v1/superadmin/users/:id`       | Get user details      | Superadmin |
| PATCH  | `/api/v1/superadmin/users/:id/admin` | Set user admin status | Superadmin |
| DELETE | `/api/v1/superadmin/users/:id`       | Delete user           | Superadmin |

### Superadmin - Site Management
| Method | Endpoint                             | Description             | Auth       |
| ------ | ------------------------------------ | ----------------------- | ---------- |
| GET    | `/api/v1/superadmin/sites`           | List all sites          | Superadmin |
| GET    | `/api/v1/superadmin/sites/:id`       | Get site details        | Superadmin |
| PATCH  | `/api/v1/superadmin/sites/:id/owner` | Transfer site ownership | Superadmin |
| DELETE | `/api/v1/superadmin/sites/:id`       | Delete site             | Superadmin |

### Superadmin - Comment Management
| Method | Endpoint                                  | Description         | Auth       |
| ------ | ----------------------------------------- | ------------------- | ---------- |
| GET    | `/api/v1/superadmin/comments`             | List all comments   | Superadmin |
| GET    | `/api/v1/superadmin/comments/:id`         | Get comment details | Superadmin |
| PATCH  | `/api/v1/superadmin/comments/:id/status`  | Moderate comment    | Superadmin |
| POST   | `/api/v1/superadmin/comments/bulk-status` | Bulk moderate       | Superadmin |
| DELETE | `/api/v1/superadmin/comments/:id`         | Delete comment      | Superadmin |
| POST   | `/api/v1/superadmin/comments/bulk-delete` | Bulk delete         | Superadmin |

## Project Structure

```
worker/
├── package.json
├── wrangler.toml           # Cloudflare Workers config
├── tsconfig.json
├── migrations/
│   └── 0001_init.sql       # D1 schema
└── src/
    ├── index.ts            # Main entry point + router
    ├── types.ts            # TypeScript types
    ├── db/
    │   └── index.ts        # Database queries
    ├── routes/
    │   ├── index.ts        # Route exports
    │   ├── auth.ts         # Auth handlers
    │   ├── comments.ts     # Comment handlers
    │   └── likes.ts        # Like handlers
    └── middleware/
        ├── index.ts        # Middleware exports
        └── auth.ts         # Auth + CORS middleware
```

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: [Hono](https://hono.dev/)
- **Database**: Cloudflare D1 (SQLite)
- **Validation**: [Zod](https://zod.dev/)
- **Language**: TypeScript
- **Package Manager**: Bun

## Environment Variables

| Variable         | Description                   | Required |
| ---------------- | ----------------------------- | -------- |
| `JWT_SECRET`     | Secret for session tokens     | Yes      |
| `RESEND_API_KEY` | Resend API key for emails     | No       |
| `BASE_URL`       | Base URL for magic links      | Yes      |
| `ENVIRONMENT`    | `development` or `production` | Yes      |

## License

MIT
