# Changelog — Day Tracker

## v4.20 — 2026-09-05
**Tipo:** Minor (dimensioni e spaziatura vista Oggi)

- Anello acqua più grande nella vista "Oggi" (da 64 a 88px).
- Più spazio tra l'anello acqua e la griglia dei task, che ora scende più in basso invece di stare subito sotto l'anello.

## v4.19 — 2026-09-05
**Tipo:** Minor (fix scroll onboarding — pagina intera)

- Il reset dello scroll ad ogni cambio pagina dell'onboarding non copriva lo scroll della pagina intera (solo quello del riquadro interno), quindi con "Salta" premuto più volte lo scroll generale poteva restare più in basso. Ora si azzera anche quello.

## v4.18 — 2026-09-05
**Tipo:** Minor (fix scroll onboarding)

- Cambiando pagina nell'onboarding (Avanti/Indietro/Salta), la vista riparte sempre dall'alto invece di mantenere la posizione di scroll della pagina precedente.

## v4.17 — 2026-09-05
**Tipo:** Minor (fix definitivo taglio ruota — bypass Recharts)

- Basta tentativi di correggere le proprietà del grafico: quando c'è una sola fetta (giornata senza attività registrate, tutta "Altro"), la ruota ora è un anello SVG disegnato direttamente, senza passare dalla libreria dei grafici. Elimina alla radice qualsiasi artefatto di rendering, qualunque fosse la causa esatta. La ruota con più fette (quando registri almeno un'attività) continua a usare il grafico normale, invariato.

## v4.16 — 2026-09-05
**Tipo:** Minor (fix definitivo taglio ruota — tentativo)

- Trovata la causa reale del taglio: la cucitura dove l'arco della fetta si richiude a 360°, resa visibile da `stroke="none"`. Ora ogni fetta ha lo stroke dello stesso colore del riempimento, che copre esattamente quella cucitura.

## v4.15 — 2026-09-05
**Tipo:** Minor (fix taglio ruota con una sola fetta — tentativo parziale)

- Corretto un difetto grafico: quando la ruota ha una sola fetta (es. giornata tutta "Altro", nessuna attività ancora registrata), lo spazio tra le fette creava un taglio visibile anche senza altre fette. Ora quello spazio si applica solo quando ci sono davvero più fette.

## v4.14 — 2026-09-05
**Tipo:** Minor (fix allineamento griglia task)

- La griglia dei task in "Oggi" partiva dal bordo sinistro della colonna, apparendo incollata alla ruota delle attività invece che allineata sotto l'anello dell'acqua. Ora è centrata e più distanziata verticalmente, coerente con l'anello sopra.

## v4.13 — 2026-09-05
**Tipo:** Minor (layout Oggi e griglia task)

- "Acqua" è ora la terza riga estendibile in Oggi, accanto a Task e Attività (stessa logica ad accordion).
- Nella vista in alto: ruota delle attività grande a sinistra, anello acqua e una nuova **griglia dei task** (fino a 12, disposti 4×3) a destra — quadratini grigi con segno di spunta verde quando completati, toccabili per segnare fatto/non fatto direttamente dalla vista principale.

## v4.12 — 2026-09-05
**Tipo:** Minor (fix comportamento Salta onboarding)

- Corretto: "Salta" nella fase 2 ora porta alla fase 3, non chiude più direttamente l'onboarding. Solo "Salta" nell'ultima fase (3) entra nell'app.

## v4.11 — 2026-09-05
**Tipo:** Minor (informativa privacy in onboarding)

- Aggiunta un'informativa privacy/termini d'uso in fondo alla prima pagina dell'onboarding, con checkbox di accettazione obbligatoria per procedere. Il testo riflette onestamente come funziona l'app: tutto offline, dati solo sul dispositivo, nessun cookie/tracciamento/server.

## v4.10 — 2026-09-05
**Tipo:** Minor (tasto Indietro onboarding)

- Aggiunto il tasto "Indietro" in basso a sinistra nell'onboarding (visibile dalla fase 2 in poi) per tornare alla pagina precedente.

## v4.9 — 2026-09-05
**Tipo:** Minor (fix onboarding)

- Tolto il tasto "Salta" dalla prima pagina dell'onboarding (nome e info personali): resta solo su fase 2 e 3, dato che il nome è obbligatorio per procedere.

## v4.8 — 2026-09-05
**Tipo:** Minor (navigazione onboarding standard)

- Onboarding: aggiunta una barra in alto con i **3 pallini di avanzamento** e il tasto **"Salta"** in alto a destra (salta l'intero onboarding da qualsiasi fase). Il tasto **"Avanti"/"Fine"** si trova ora in basso a destra.

## v4.7 — 2026-09-05
**Tipo:** Minor (onboarding a più fasi)

- La welcome page è ora un **wizard a 3 fasi**: 1) identità (nome, anno di nascita, altezza, peso), 2) personalizza attività e task (stesse sezioni di Personalizza, utilizzabili già prima di entrare nell'app), 3) personalizza acqua (unità di misura e obiettivo).
- Fase 1 richiede il nome per proseguire ("Avanti"); fasi 2 e 3 sono facoltative e hanno un tasto "Salta" in basso a sinistra per passare oltre senza configurare nulla.

## v4.6 — 2026-09-05
**Tipo:** Minor (pulizia selettore colore)

- Tolto il codice esadecimale (es. #FF0000) accanto al cerchio colore: dettaglio tecnico non utile per l'uso quotidiano.
- Confermato/verificato: riaprendo il selettore prima di aver creato l'elemento si riparte dall'ultimo colore confermato; creando un nuovo elemento (categoria/task/una tantum) il selettore riparte sempre da rosso puro.

## v4.5 — 2026-09-05
**Tipo:** Minor (selettore colore personalizzato)

- Sostituito il selettore colore nativo del telefono (che mostrava colori suggeriti e slider Tonalità/Saturazione/Valore non controllabili dall'app) con un selettore **interamente nostro**: solo Tonalità e Saturazione (il Valore resta sempre al massimo, così i colori restano sempre vivi/leggibili), anteprima al centro, "Annulla" a sinistra e "Conferma" a destra.
- Ogni volta che crei una nuova categoria, task o voce "una tantum", il selettore riparte sempre da **rosso puro** (#FF0000).

## v4.4 — 2026-09-05
**Tipo:** Minor (selettore colore semplificato)

- Tolta la tavolozza fissa di colori preimpostati per categorie/task/una tantum: resta solo il selettore colore nativo del telefono (spettro completo), con codice esadecimale visibile accanto.

## v4.3 — 2026-09-05
**Tipo:** Minor (separazione Task/Attività in Personalizza)

- In Personalizza, "Task" ora è una pillola separata da "Attività" (prima la gestione task era annidata in fondo alla sezione Attività).

## v4.2 — 2026-09-05
**Tipo:** Minor (riorganizzazione gestione task/attività + riordino)

- La gestione dei task (aggiungi/elimina) si è spostata in **Personalizza → Attività**: nel tab "Oggi" resta solo la spunta fatto/non fatto.
- Nel tab "Oggi", "Attività" e "Task" sono ora **due righe estendibili** (accordion) invece di pillole esclusive: puoi tenerle aperte entrambe insieme o chiuderle per fare spazio.
- Aggiunto il **riordino personalizzato**: sia le attività (base + personalizzate, in un unico elenco unificato) sia i task si possono riordinare con le frecce su/giù da Personalizza. L'ordine scelto si riflette ovunque compaiono le pillole delle categorie.

## v4.1 — 2026-09-05
**Tipo:** Minor (miglioramento Storico)

- Lo **Storico** ora usa un vero calendario mensile al posto delle frecce avanti/indietro: naviga tra i mesi e tocca direttamente un giorno. I giorni con dati salvati hanno un puntino indicatore.
- Selezionando un giorno si vede tutto insieme: ruota delle attività, anello dell'acqua, e l'elenco dei task con stato fatto/non fatto per quella giornata.

## v4.0 — 2026-09-05
**Tipo:** Major (nuova funzionalità sostanziale + ristrutturazione layout)

- Aggiunta la sezione **Task giornalieri** dentro il tab "Oggi": checklist di attività ricorrenti (es. "Routine mattutina", preimpostata), completamente personalizzabili per nome e colore, aggiungibili/eliminabili liberamente.
- **Ristrutturato il layout di "Oggi"**: sotto-navigazione a pillole "Attività" / "Task" per far rientrare tutto (attività a tempo, task, acqua) senza affollare lo schermo.
- Le **categorie base** (Sonno, Money, ecc.) ora si possono **eliminare davvero** (non solo nascondere) con l'icona cestino; restano comunque ripristinabili da un elenco "Categorie base eliminate" se servono di nuovo. Lo storico passato non viene mai toccato.
- Aggiunto un **selettore colore libero** (oltre alla tavolozza fissa) ovunque si scelga un colore — categorie personalizzate, voci "una tantum", task — per poter usare qualsiasi colore, non solo i 12 preimpostati.

## v3.3 — 2026-09-02
**Tipo:** Minor (riorganizzazione + welcome page)

- Introdotto lo schema di versionamento con cartella principale `day-tracker_v[versione]` e questo file CHANGELOG.md, aggiornato ad ogni versione.
- Aggiunta la **welcome page** (onboarding) mostrata al primo avvio dell'app: raccoglie Nome (obbligatorio), Anno di nascita, Altezza, Peso e Obiettivo acqua iniziale (tutti opzionali tranne il nome).
- Aggiunta la sezione **"Profilo"** nel tab Personalizza, per modificare in qualsiasi momento i dati raccolti in onboarding.
- Il tab "Oggi" ora saluta con il nome dell'utente ("Ciao [Nome], ecco la tua giornata") al posto del titolo generico.

## v3.0–v3.2 — data non tracciata con precisione
**Tipo:** baseline

Versioni precedenti all'introduzione di questo changelog. In sintesi, lo stato raggiunto includeva:
- Tracciamento del tempo con ruota a 24h, categoria "Altro" come residuo automatico del tempo non tracciato.
- Gestione categorie: base (nascondibili) + personalizzate (create dall'utente con nome/colore) + categoria "una tantum" attivabile/disattivabile.
- Tracciamento acqua: anello accanto alla ruota del tempo, obiettivo e unità di misura (ml/L) configurabili, grafici trend dedicati.
- Sveglie/promemoria con notifiche native Android (via Capacitor).
- Tab "Personalizza" con sezioni Attività, Acqua, Sveglie.
- Build APK interamente su GitHub Actions (Capacitor + chiave di firma fissa per aggiornamenti in-place senza perdita dati).
