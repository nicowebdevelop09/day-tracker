import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Percorso relativo: funziona sia su GitHub Pages (sottocartella)
  // sia dentro l'app Capacitor, che serve i file da un percorso locale.
  base: "./",
  plugins: [react()],
});
