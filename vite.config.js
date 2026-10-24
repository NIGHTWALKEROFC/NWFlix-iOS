import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  base: "./",
  plugins: [nodePolyfills({ globals: { Buffer: true, global: true, process: true } })],
  build: { target: "es2020", chunkSizeWarningLimit: 4000 }
});
