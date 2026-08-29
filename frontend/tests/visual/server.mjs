import { createServer, mergeConfig } from "vite";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import base from "../../vite.config.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const port = Number(process.env.SQUADCHAT_VISUAL_PORT || 4174);
const html = '<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SquadChat · QA local</title></head><body><div id="root"></div><script type="module" src="/tests/visual/App.jsx"></script></body></html>';
const server = await createServer(mergeConfig(base, {
  root,
  configFile: false,
  esbuild: {
    loader: "jsx",
    include: /(?:src|tests)\/.*\.[jt]sx?$/,
    exclude: []
  },
  optimizeDeps: {
    entries: ["tests/visual/App.jsx"]
  },
  cacheDir: resolve(root, `node_modules/.vite-visual-${port}`),
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    open: false
  },
  resolve: {
    alias: [{
      find: "./api",
      replacement: resolve(root, "tests/visual/api.js")
    }, {
      find: /.*\/services\/api$/,
      replacement: resolve(root, "tests/visual/api.js")
    }, {
      find: /.*\/services\/socket-io$/,
      replacement: resolve(root, "tests/visual/socket.js")
    }]
  },
  plugins: [{
    name: "visual-fixtures",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.headers.accept?.includes("text/html") && !req.url.includes(".")) {
          res.setHeader("Content-Type", "text/html");
          res.end(await server.transformIndexHtml(req.url, html));
          return;
        }
        next();
      });
    }
  }]
}));
await server.listen();
console.log(`Isolated visual preview: http://127.0.0.1:${port}/tickets (synthetic data, no backend)`);
