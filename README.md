# Day Tracker — APK nativo con sveglie vere, tutto via GitHub Actions

App di tracciamento del tempo, 100% offline, dati salvati solo sul dispositivo.
Ora con notifiche/sveglie native Android (funzionano anche ad app chiusa),
grazie a Capacitor. Nessuna installazione di Android Studio richiesta: tutto
si compila nel cloud tramite GitHub Actions.

## 1. Primo setup (una tantum)

1. Carica tutto il contenuto di questa cartella alla **radice** del tuo
   repository GitHub (compresa la cartella nascosta `.github`).
2. Vai nella tab **Actions** del repo → nella lista a sinistra clicca
   **"Generate signing key (esegui una sola volta)"** → **"Run workflow"** →
   **Run workflow** (bottone verde) per farlo partire.
3. Aspetta che finisca (pallino verde), poi apri quella run → in fondo alla
   pagina trovi la sezione **Artifacts** → scarica `signing-key` (uno zip
   con `debug.keystore.base64` dentro).
4. Apri `debug.keystore.base64` con un editor di testo, copia **tutto** il
   contenuto (è una lunga stringa senza spazi).
5. Nel repo: **Settings → Secrets and variables → Actions → New repository
   secret**. Nome: `DEBUG_KEYSTORE_BASE64`. Valore: incolla la stringa
   copiata. Salva.

Questo passaggio garantisce che ogni APK futuro sia firmato con la stessa
chiave, così puoi installare gli aggiornamenti sopra la versione precedente
senza perdere i dati salvati.

## 2. Genera l'APK

1. Tab **Actions** → **"Build APK (Capacitor)"** → **Run workflow** (oppure
   parte da solo ad ogni push su `main`).
2. Aspetta il pallino verde (qualche minuto: scarica e configura l'SDK
   Android la prima volta).
3. Apri la run completata → **Artifacts** → scarica `day-tracker-apk`.
4. Dentro lo zip c'è `app-debug.apk`: trasferiscilo sul telefono e
   installalo (va abilitato "Installa da origini sconosciute" la prima
   volta, in Impostazioni Android).

## 3. Come aggiornare l'app in futuro

1. Modifica il codice, carica le modifiche sul repo (push).
2. Il workflow **"Build APK (Capacitor)"** riparte da solo.
3. Scarica il nuovo `day-tracker-apk` dagli Artifacts della run più recente.
4. Installalo **sopra** l'app esistente sul telefono (non serve
   disinstallare prima): stessa chiave di firma = aggiornamento in-place,
   dati salvati mantenuti.

## Sviluppo locale (facoltativo)

```bash
npm install
npm run dev       # anteprima nel browser
npm run build     # compila la parte web (lo stesso che fa la Action)
```

## Note

- Le sveglie ora sono notifiche **native Android**: funzionano anche con
  l'app chiusa o il telefono bloccato, a differenza della versione PWA
  precedente. La prima volta che apri il tab "Sveglie" nell'app, concedi il
  permesso di notifica quando richiesto.
- L'APK generato è una build "debug": perfettamente installabile e
  funzionante per uso personale, semplicemente non è ottimizzata/minificata
  al massimo. Se in futuro vorrai pubblicarla su Play Store servirebbe un
  passaggio ulteriore (build "release" con chiave dedicata) — per uso sul
  tuo telefono non serve.
- È rimasto anche il workflow `deploy.yml` che pubblica la versione web su
  GitHub Pages, utile se vuoi anche una versione accessibile da browser.
