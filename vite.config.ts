import { defineConfig } from 'vitest/config';
import type { Plugin, ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Führt die Vercel-Funktionen aus /api auch im lokalen Dev-Server aus,
 * damit Lebenslauf-/Webseiten-Import ohne `vercel dev` testbar sind.
 */
function vercelApiDev(): Plugin {
  return {
    name: 'persocrm-api-dev',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url ?? '';
        const match = url.match(/^\/api\/([a-z-]+)(?:\?|$)/);
        if (!match) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${match[1]}.ts`);
          const handler = mod[req.method ?? 'GET'] as ((r: Request) => Promise<Response>) | undefined;
          if (!handler) {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === 'string') headers.set(k, v);
          }
          const request = new Request(`http://localhost${url}`, {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
          });
          const response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          server.config.logger.error(String(err));
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Interner Fehler im Dev-Server.' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), vercelApiDev()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
