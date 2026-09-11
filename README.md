# Orbit — Kirghizistan e Uzbekistan, 9–23 settembre 2026

Dashboard del viaggio: una pagina web che si apre con un doppio clic su
`index.html`, senza installare nulla. Funziona da file locale; mappa,
meteo e foto richiedono la connessione (tutto gratuito, senza chiavi API).

## Struttura a settori

Ogni file fa una cosa sola. Per modificare qualcosa si tocca **un solo file**.

| Cosa vuoi cambiare | File |
|---|---|
| Date, tratte, programmi, punti di interesse | `js/data.js` (sezioni `P`, `LEGS`, `DAYS`, `POIS`) |
| Prenotazioni alloggi, budget, app consigliate | `js/data.js` (sezioni `BOOKINGS`, `BUDGET`, `APPS`) |
| Colori, font, misure | `css/tokens.css` |
| Aspetto generale (testata, barra, tipografia) | `css/base.css` |
| Card, chip, bottoni, badge | `css/components.css` |
| Stile delle singole sezioni | `css/sections.css` |
| Struttura della pagina (ordine delle sezioni) | `index.html` |
| Card «Oggi», Alloggi, Soldi, App | `js/sections.js` |
| Selettore e scheda delle giornate (incluso il Diario) | `js/days.js` |
| Elenco spostamenti | `js/legs.js` |
| Checklist (valigia e cose da fare) | `js/checklist.js` + dati in `js/data.js` (`CHECKLISTS`) |
| Convertitore valute e registro spese | `js/money.js` |
| Pratico & emergenze, Documenti | `js/sections.js` + dati in `js/data.js` (`PRATICO`, `DOCS`) |
| Foto e video vostri (per giornata) | `js/media.js` |
| Condivisione con i cari | `js/pubblica.js` |
| Foto sincronizzate fra i due telefoni | `js/sync.js` |
| Pagina pubblica per i cari | `pubblico/` |
| Ripulitura dei dati pubblici (computer e telefono) | `js/sanifica.js` |
| Modifica dei dati dal telefono | `js/dati.js` |
| Intro cinematografica | `js/cinematic.js` |
| Ornamenti kirghisi e uzbeki | `js/ornaments.js` + `css/ornaments.css` |
| Documenti PDF cifrati | `js/docs.js` (i .bin li genera `tools/lock.mjs`) |
| Offline (service worker) | `sw.js` |
| Mappa, percorso, punti di interesse | `js/map.js` |
| Meteo | `js/weather.js` |
| Orologi | `js/clocks.js` |
| Ordine di avvio | `js/main.js` |

## Come funziona

- **Oggi**: la prima card sceglie da sola la giornata in base alla data.
- **Giornate**: 15 schede con tre viste (Programma, Luoghi e storie con
  foto da Wikipedia, Notte e soldi). Le voci del programma cliccabili
  volano sul punto in mappa.
- **Spostamenti**: le 23 tratte con orari, avvisi e codici copiabili
  (un tocco copia il codice).
- **Mappa**: percorso completo colorato per mezzo (MapLibre; basi
  OpenStreetMap, OpenTopoMap ed Esri, tutte senza chiave API);
  la giornata selezionata è evidenziata con i suoi punti di interesse e i
  collegamenti a Google Maps, Yandex e 2GIS. Le strade vere arrivano da
  OSRM e restano salvate nel browser.
- **Meteo**: Open-Meteo, aggiornato ogni ora; senza rete restano le medie
  climatiche di settembre.
- **Checklist**: spunte e voci aggiunte restano salvate nel browser.
- **Soldi**: cambio EUR/som live (open.er-api.com, cache 12 h) e registro
  spese confrontato col budget; tutto salvato nel browser.
- **Diario**: per ogni giornata una nota più le vostre foto e i vostri
  video, con didascalia. Stanno in IndexedDB (non in localStorage, che
  si riempie a 5 MB): le foto vengono ridotte a 1600 px, i video restano
  interi. Sono solo sul dispositivo, non vengono caricati da nessuna
  parte. Col tasto **Sincronizza** salgono su GitHub **cifrate** con la
  stessa password e scendono sull'altro telefono: i due dispositivi
  vedono le stesse foto, nessun altro può aprirle, e diventano una copia
  di sicurezza fuori dal telefono. Le cancellazioni non si propagano: se
  uno dei due elimina una foto, l'altro la tiene.
- **Documenti**: i PDF restano nella cartella Bishkek sul Mac e sono solo
  collegati; non vengono copiati nel repository né pubblicati.
- **Offline**: quando la pagina è servita via https, il service worker
  (`sw.js`) la salva per l'uso senza rete e si può aggiungere alla
  schermata Home dell'iPhone come app.
- **Intro**: all'apertura la mappa va a tutto schermo e percorre le 23
  tratte dall'alto, con la scia che si accende, il contachilometri e i
  cartelli delle città. Si salta col bottone o con ESC, parte una volta
  per sessione e si rivede dal bottone sotto la mappa.
- **Ornamenti**: il tunduk (la corona della yurta, quella della bandiera
  kirghisa) che ruota, la fascia a corna d'ariete che scorre, le righe
  che si disegnano allo scorrimento e la stella girih delle maioliche
  di Samarcanda sulle sezioni uzbeke.
- **Documenti**: gli 11 PDF sono cifrati in `docs/*.bin` e si aprono
  dentro la pagina, anche dal telefono e anche senza rete. Il manifest
  pubblico contiene solo numeri di file: né titoli né codici.
- Tema chiaro/scuro automatico secondo le impostazioni del sistema.

## Privacy: i dati sono cifrati

La pagina contiene PIN di Booking, codici di prenotazione e numeri di
telefono. Su GitHub Pages il sito è per forza raggiungibile da chiunque
abbia l'indirizzo, quindi i dati **non vengono pubblicati in chiaro**:

- `js/data.js` — dati leggibili, **restano solo sul Mac** (in `.gitignore`)
- `js/data.enc.js` — gli stessi dati cifrati con AES-256-GCM, questo è
  l'unico che finisce online
- `js/boot.js` — se trova i dati in chiaro parte subito (copia sul Mac);
  altrimenti chiede la password, decifra nel browser e parte

Chi apre l'indirizzo senza password vede solo la schermata di sblocco.
La password si digita una volta per dispositivo, poi resta memorizzata.

**Dopo ogni modifica ai dati** va rigenerato il file cifrato:

```
node tools/lock.mjs                  # riusa la password salvata
node tools/lock.mjs "nuova password" # per cambiarla
```

## Le due pagine

| | Indirizzo | Chi la apre |
|---|---|---|
| Privata | `/orbit/` | solo voi, con la password |
| Per i cari | `/orbit/pubblico/` | chiunque abbia il link |

La pagina pubblica legge `pubblico/dati.js`, generato da `tools/lock.mjs`
togliendo codici, nomi delle strutture, indirizzi, telefoni e spese. Se
qualcosa di riservato dovesse sfuggire, **la generazione si ferma** invece
di pubblicare.

Foto e note ci arrivano dalla pagina privata: nella scheda Diario si
sceglie cosa mandare e `js/pubblica.js` lo carica in `pubblico/diario/`
tramite l'API di GitHub. Serve una chiave personale (token con permesso
*Contents: read and write* sul solo repository `orbit`), chiesta una
volta e conservata solo sul dispositivo.

## Modificare il viaggio dal telefono

In fondo alla pagina privata c'è la sezione **I dati del viaggio**: mostra
il contenuto di `js/data.js`, lo lascia correggere e lo rimanda su GitHub
già ricifrato, usando la chiave della password e il token delle foto.
Prima di salvare il testo viene controllato in un contesto isolato: se non
è codice valido, se manca una costante o se una tratta punta a una giornata
inesistente, non parte nulla.

Lo stesso salvataggio rifà anche `pubblico/dati.js`, così la pagina dei
cari resta allineata. La ripulitura sta in **un file solo**,
`js/sanifica.js`, usato sia da `tools/lock.mjs` sul computer sia dalla
pagina nel telefono: due copie potrebbero divergere, e una divergenza qui
vorrebbe dire dati riservati su una pagina pubblica. Verificato che le due
strade producono un risultato identico byte per byte.

## Se questo computer sparisce

Nel repository c'è tutto tranne due file: `js/data.js` (i dati in chiaro)
e `.orbit-pw` (la password). Non servono: si ricostruiscono dal file
cifrato, che invece è pubblicato. Su una macchina qualsiasi:

```
git clone https://github.com/alintitaru-create/orbit
cd orbit
node tools/unlock.mjs "la password"
```

e la copia di lavoro torna completa. Provato davvero: da un clone pulito
si riottengono 19 luoghi, 23 tratte, 15 giornate, 64 punti, 5 prenotazioni
e 11 documenti, identici.

Se i PDF originali non sono su quella macchina, `tools/lock.mjs` **non
tocca** i documenti già cifrati invece di cancellarli.

## Pubblicazione

Il sito è pubblicato con GitHub Pages dal branch `main`. Per aggiornare:

```
node tools/lock.mjs      # solo se sono cambiati i dati
git add -A && git commit -m "..." && git push
```

Pages si riaggiorna da solo in un paio di minuti.

I PDF delle prenotazioni non entrano mai nel repository: restano nella
cartella `Desktop/Bishkek` e la sezione Documenti li collega soltanto
quando la pagina è aperta dal Mac.
