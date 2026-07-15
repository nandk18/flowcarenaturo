import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mcpPlugin(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      devOptions: { enabled: false },
      manifest: false,
      includeAssets: [
        "favicon.png",
        "apple-touch-icon.png",
        "flowcare-icon-192.png",
        "flowcare-icon-512.png",
        "therapist-icon-192.png",
        "therapist-icon-512.png",
        "therapist-apple-touch.png",
        "manifest-admin.webmanifest",
        "manifest-therapist.webmanifest",
        "offline.html",
      ],
      workbox: {
        navigateFallback: "/offline.html",
        navigateFallbackDenylist: [/^\/\.lovable\/oauth\//, /^\/~oauth/],
        globPatterns: ["**/*.{js,css,ico,png,svg,webmanifest,html}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-nav",
              networkTimeoutSeconds: 2,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\.(?:js|css|woff2?|png|svg|jpg|jpeg)$/.test(url.pathname),
            handler: "CacheFirst",
            options: { cacheName: "assets", expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
