import { defineConfig, mergeConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import base from "../../vite.config.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export default defineConfig(mergeConfig(base, {
  root,
  configFile: false,
  esbuild: {
    loader: "jsx",
    include: /(?:src|tests)\/.*\.[jt]sx?$/,
    exclude: []
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
  build: {
    outDir: "build-visual",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(root, "tests/visual/index.html")
    }
  }
}));
