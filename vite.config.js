import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Percorso relativo: funziona sia su GitHub Pages (sottocartella)
  // sia dentro l'app Capacitor, che serve i file da un percorso locale.
  base: "./",
  // Compila in una sintassi compatibile anche con WebView Android meno
  // recenti (es. senza optional chaining nativo), per evitare schermate
  // vuote su dispositivi con System WebView datato.
  build: {
    target: "es2015",
  },
  plugins: [react()],
});
