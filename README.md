# ThreadEngine Worker (Cloudflare Workers + D1)

A TypeScript-based Cloudflare Workers implementation of ThreadEngine, using Hono as the web framework and D1 (SQLite) for persistence.

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
bunx wrangler d1 create thread-engine-db
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "thread-engine-db"
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

### Comments
| Method | Endpoint                            | Description               | Auth     |
| ------ | ----------------------------------- | ------------------------- | -------- |
| GET    | `/api/v1/sites/:id/pages/:slug`     | Get page comments + likes | No       |
| POST   | `/api/v1/sites/:id/pages/:slug`     | Create comment            | Optional |
| GET    | `/api/v1/sites/:id/comments`        | List all site comments    | Yes      |
| DELETE | `/api/v1/sites/comments/:id`        | Delete comment            | Yes      |
| PATCH  | `/api/v1/sites/comments/:id`        | Edit comment              | Yes      |
| PATCH  | `/api/v1/sites/comments/:id/status` | Moderate comment          | Yes      |

### Likes
| Method | Endpoint                     | Description       | Auth |
| ------ | ---------------------------- | ----------------- | ---- |
| GET    | `/api/v1/pages/:id/likes`    | Get page likes    | No   |
| POST   | `/api/v1/pages/:id/likes`    | Like page         | Yes  |
| DELETE | `/api/v1/pages/:id/likes`    | Unlike page       | Yes  |
| GET    | `/api/v1/comments/:id/likes` | Get comment likes | No   |
| POST   | `/api/v1/comments/:id/likes` | Like comment      | Yes  |
| DELETE | `/api/v1/comments/:id/likes` | Unlike comment    | Yes  |

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

## Migrating from Go/PostgreSQL

This is a rewrite of the original Go + PostgreSQL ThreadEngine. Key differences:

1. **Database**: PostgreSQL → D1 (SQLite)
2. **Runtime**: Go binary → Cloudflare Workers
3. **Framework**: net/http → Hono
4. **Language**: Go → TypeScript
5. **Connection pooling**: Handled by D1 automatically
6. **Triggers**: Implemented in application code

## License

MIT
