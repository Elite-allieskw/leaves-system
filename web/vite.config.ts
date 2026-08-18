import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      // The backend's local-disk storage fallback (used when S3_BUCKET isn't
      // set) returns root-relative "/uploads/..." URLs meant to be resolved
      // against the API host. Proxy them too so photo/video links work in
      // local dev — this only matters pre-S3; once a bucket is configured,
      // uploadFile() returns absolute URLs and this proxy is a no-op.
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
