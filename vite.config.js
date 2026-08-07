import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Percorso relativo: funziona sia su GitHub Pages (sottocartella)
  // sia dentro l'app Capacitor, che serve i file da un percorso locale.
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        id: "/",
        name: "Day Tracker — Diario del tempo",
        short_name: "Day Tracker",
        description: "Traccia il tempo dedicato alle tue attività quotidiane. Completamente offline, senza login, i dati rimangono sempre sul tuo telefono.",
        categories: ["productivity"],
        screenshots: [],
        theme_color: "#15161B",
        background_color: "#15161B",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/day-tracker/",
        scope: "/day-tracker/",
        dir: "ltr",
        lang: "it-IT",
        prefer_related_applications: false,
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ],
        shortcuts: [
          {
            name: "Registra attività",
            short_name: "Registra",
            description: "Aggiungi un'attività rapida",
            url: "/?tab=today",
            icons: [{ src: "icon-192.png", sizes: "192x192" }]
          }
        ]
      },
      workbox: {
        // precache di tutto l'app shell: dopo il primo caricamento funziona 100% offline
        globPatterns: ["**/*.{js,css,html,png,svg}"]
      }
    })
  ]
});
