import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { mp3EncoderVitePlugin, mp3EncoderEsbuildPlugin } from "./tooling/mp3EncoderCompat.mjs";
export default defineConfig({
  plugins: [mp3EncoderVitePlugin(), react({
    jsxRuntime: "classic"
  })],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: "build",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          "material-ui-core": ["@material-ui/core"],
          "emoji-picker": ["emoji-mart"],
          "audio-recorder": ["mic-recorder-to-mp3"]
        }
      }
    }
  },
  envPrefix: "VITE_",
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.[jt]sx?$/,
    exclude: []
  },
  define: {
    global: "globalThis"
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx"
      },
      plugins: [mp3EncoderEsbuildPlugin()]
    },
    include: ["howler", "@material-ui/core"],
    exclude: []
  },
  resolve: {
    alias: {
      "jss-plugin-globalThis": "jss-plugin-global"
    }
  }
});
