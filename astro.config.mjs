import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://FDtkato.github.io",
  base: "/OSHI-portal",
  vite: {
    plugins: [tailwindcss()],
  },
});
