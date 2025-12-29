import { serve } from "bun";
import { join } from "path";
import index from './index.html'
import widget from './widget.html'

const publicDir = join(import.meta.dir, "../public");

const server = serve({
  routes: {
    "/": index,
    "/widget": widget,
  },
  async fetch(req) {
    const url = new URL(req.url);

    // Serve static files from public folder
    const filePath = join(publicDir, url.pathname);
    try {
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file, {
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    } catch (e) {
      // File doesn't exist
    }

    // Not found
    return new Response("Not Found", { status: 404 });
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`Server running at ${server.url}`);
console.log(`- Dashboard: ${server.url}`);
console.log(`- Widget: ${server.url}/widget`);
console.log(`- Embed script: ${server.url}/commentkit.js`);
