import {defineConfig} from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({tsDecorators: true})],
  base: "/ui/",
  build: {outDir: "build"},
  optimizeDeps: {
    entries: "./index.html",
  },
  esbuild: {
    // don't minify class names, to preserve edgedb error names
    keepNames: true,
  },
  preview: {port: 3002},
  server: {port: 3002},
});
