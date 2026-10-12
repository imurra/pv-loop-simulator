// Builds the archived v1 simulator into dist/v1, served at /pv-loop-simulator/v1/.
// The files in legacy/v1/src are byte-for-byte copies of commit f095099
// (tag v1.0 / branch archive/v1). Only the banner in index.html is new.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  base: "/pv-loop-simulator/v1/",
  build: {
    outDir: fileURLToPath(new URL("../../dist/v1", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
  },
});
