import path from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    define: process.env.NODE_ENV === "production"
        ? {
            "import.meta.env.VITE_IS_DEMO": JSON.stringify(process.env.VITE_IS_DEMO),
            "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(process.env.VITE_SUPABASE_URL),
            "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
            "import.meta.env.VITE_INBOUND_EMAIL": JSON.stringify(process.env.VITE_INBOUND_EMAIL),
        }
        : undefined,
    base: "./",
    esbuild: {
        keepNames: true,
    },
    build: {
        sourcemap: true,
    },
    resolve: {
        preserveSymlinks: true,
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
