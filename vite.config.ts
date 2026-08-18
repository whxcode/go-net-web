import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    // Fix libsodium-wrappers-sumo broken ESM import
    {
      name: "fix-libsodium-esm",
      resolveId(source, importer) {
        if (
          source === "./libsodium-sumo.mjs" &&
          importer &&
          importer.includes("libsodium-wrappers-sumo")
        ) {
          // ✅ 改成 .js
          return path.resolve(
            __dirname,
            "node_modules/libsodium-sumo/dist/modules-sumo/libsodium-sumo.js",
          );
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
      },
    },
  },
});
