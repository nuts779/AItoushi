import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { macroPlugin } from "./vite-plugin-macro";

export default defineConfig({
  plugins: [react(), tailwindcss(), macroPlugin()],
});