# Day Tracker — APK nativo con sveglie vere, tutto via GitHub Actions

App di tracciamento del tempo, 100% offline, dati salvati solo sul dispositivo.
Notifiche/sveglie native Android (funzionano anche ad app chiusa), grazie a
Capacitor. Nessuna installazione di Android Studio richiesta: tutto si
compila nel cloud tramite GitHub Actions.

## 1. Primo setup (una tantum)

1. Carica tutto il contenuto di questa cartella alla **radice** del tuo
   repository GitHub (compresa la cartella nascosta `.github`).
2. Tab **Actions** → **"Generate signing key (esegui una sola volta)"** →
   **Run workflow**.
3. A run completata → **Artifacts** → scarica `signing-key`, apri
   `debug.keystore.base64`, copia tutto il contenuto.
4. **Settings → Secrets and variables → Actions → New repository secret**.
   Nome: `DEBUG_KEYSTORE_BASE64`. Valore: la stringa copiata.

## 2. Genera l'APK

1. Tab **Actions** → **"Build APK (Capacitor)"** → **Run workflow** (o
   parte da solo ad ogni push su `main`).
2. A run completata → **Artifacts** → scarica `day-tracker-apk` →
   `app-debug.apk` → installalo sul telefono.

## 3. Come aggiornare l'app in futuro

1. Push delle modifiche → la Action riparte da sola.
2. Scarica il nuovo `day-tracker-apk` dagli Artifacts della run più recente.
3. Installalo **sopra** l'app esistente: stessa chiave di firma =
   aggiornamento in-place, dati mantenuti.

## Sviluppo locale (facoltativo)

```bash
npm install
npm run dev
npm run build
```
