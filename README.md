# Orbit — i nostri viaggi

L'applicazione dei viaggi: quelli fatti restano, quelli da fare si
organizzano. Si apre con un doppio clic su `index.html`, senza installare
nulla. Funziona da file locale; mappa, meteo e foto richiedono la
connessione (tutto gratuito, senza chiavi API).

## Due pagine, non una

- **Lo scaffale** (`index.html`) — la prima schermata: i viaggi divisi in
  *in corso*, *in arrivo* e *ricordi*, ognuno con la forma del suo
  percorso disegnata dalle coordinate vere. Sotto, la **lavagna delle
  idee**: i posti che vi girano in testa, prima che abbiano una data.
  Da qui si crea un viaggio nuovo, anche dal telefono.
- **Il viaggio aperto** (`viaggio.html?v=<id>`) — la pagina piena:
  giornate, spostamenti, mappa, checklist, alloggi, soldi, documenti,
  diario. È la stessa di sempre; cambia solo il viaggio che legge.

Che faccia abbia un viaggio lo decidono le date, non un'impostazione:
prima della partenza mostra il conto alla rovescia, durante la card
«Oggi», dopo il ritorno il **resoconto** — giornate, chilometri, punto
più alto, speso contro previsto, foto e note rimaste.

## Struttura a settori

Ogni file fa una cosa sola. Per modificare qualcosa si tocca **un solo file**.

| Cosa vuoi cambiare | File |
|---|---|
| Elenco dei viaggi, idee, statistiche | `viaggi/index.js` (`VIAGGI`, `IDEE`, `STATS`) |
| Date, tratte, programmi, punti di interesse | `viaggi/<id>/data.js` (sezioni `P`, `LEGS`, `DAYS`, `POIS`) |
| Prenotazioni alloggi, budget, app consigliate | `viaggi/<id>/data.js` (sezioni `BOOKINGS`, `BUDGET`, `APPS`) |
| Lo scaffale: card, gruppi, viaggio nuovo | `js/scaffale.js` + `css/scaffale.css` |
| La lavagna delle idee | `js/idee.js` |
| Il resoconto di un viaggio finito | `js/ricordo.js` |
| Password, chiave, file cifrati | `js/chiave.js` |
| Elenco viaggi e chiavi di salvataggio | `js/viaggi.js` |
| Colori, font, misure | `css/tokens.css` |
| Aspetto generale (testata, barra, tipografia) | `css/base.css` |
| Card, chip, bottoni, badge | `css/components.css` |
| Stile delle singole sezioni | `css/sections.css` |
| Struttura della pagina di un viaggio | `viaggio.html` |
| Struttura dello scaffale | `index.html` |
| Card «Oggi», Alloggi, Soldi, App | `js/sections.js` |
| Selettore e scheda delle giornate (incluso il Diario) | `js/days.js` |
| Elenco spostamenti | `js/legs.js` |
| Checklist (valigia e cose da fare) | `js/checklist.js` + dati in `viaggi/<id>/data.js` (`CHECKLISTS`) |
| Convertitore valute e registro spese | `js/money.js` |
| Pratico & emergenze, Documenti | `js/sections.js` + dati in `viaggi/<id>/data.js` (`PRATICO`, `DOCS`) |
| Foto e video vostri (per giornata) | `js/media.js` |
| Dove è stata scattata una foto | `js/exif.js` |
| I percorsi fatti: deposito, conti, pannello | `js/tracce.js` |
| Registrare un percorso col telefono | `js/registra.js` |
| Leggere e scrivere file GPX | `js/gpx.js` |
| Condivisione con i cari | `js/pubblica.js` |
| Foto e percorsi sincronizzati fra i due telefoni | `js/sync.js` |
| Pagina pubblica per i cari | `pubblico/` |
| Ripulitura dei dati pubblici (computer e telefono) | `js/sanifica.js` |
| Modifica dei dati dal telefono | `js/dati.js` |
| Intro cinematografica | `js/cinematic.js` |
| Ornamenti kirghisi e uzbeki | `js/ornaments.js` + `css/ornaments.css` |
| Documenti PDF cifrati | `js/docs.js` (i .bin li genera `tools/lock.mjs`) |
| Trasloco dei dati vecchi (una volta sola) | `js/migra.js` |
| Guardia sui dati pubblici | `tools/controlla-pubblico.mjs` |
| Offline (service worker) | `sw.js` |
| Mappa, percorso, punti di interesse | `js/map.js` |
| Meteo | `js/weather.js` |
| Orologi | `js/clocks.js` |
| Ordine di avvio di un viaggio | `js/main.js` + `js/boot.js` |
| Ordine di avvio dello scaffale | `js/boot-scaffale.js` |

## Come funziona

- **Oggi**: la prima card sceglie da sola la giornata in base alla data.
- **Giornate**: 15 schede con tre viste (Programma, Luoghi e storie con
  foto da Wikipedia, Notte e soldi). Le voci del programma cliccabili
  volano sul punto in mappa.
- **Spostamenti**: le 23 tratte con orari, avvisi e codici copiabili
  (un tocco copia il codice).
- **Le vostre foto sulla mappa**: ogni foto scattata col telefono porta
  dentro le coordinate dello scatto. Orbit le legge quando la si aggiunge
  al diario — prima di rimpicciolirla, perché la riduzione le
  cancellerebbe — e le appoggia sulla mappa nel punto esatto, come
  francobolli. Le foto aggiunte prima si recuperano dalla scheda Diario,
  riscegliendole dal rullino: viene letta solo la posizione e attaccata
  alle foto già presenti, senza doppioni. Funziona con i JPEG, che è
  quello che il telefono manda; se la posizione era spenta, la foto si
  salva lo stesso, senza il suo posto.
- **I percorsi fatti davvero**: nella scheda *Percorso* di ogni giornata
  si registra il tragitto col telefono, oppure si importa un GPX (Komoot,
  Strava, Organic Maps, AllTrails, orologi: lo esportano tutti).
  Chilometri, dislivello e durata non si scrivono: si ricavano dai punti,
  con una soglia di tre metri perché il ballo del GPS non gonfi la salita.
  La traccia compare sulla mappa della giornata, col colore del mezzo,
  accanto alla tratta prevista. Ogni percorso si riscarica in GPX: non
  resta prigioniero di Orbit.
  I percorsi viaggiano fra i due telefoni con lo stesso tasto delle foto,
  cifrati con la stessa password: sul server restano byte illeggibili.
  Una registrazione ancora in corso non parte — di là arriverebbe monca —
  e le cancellazioni non si propagano, come per le foto.
  Un limite detto chiaro: con lo schermo spento l'iPhone smette di dare
  la posizione, quindi per un trekking lungo conviene l'app del trekking
  e poi importare il GPX.
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
- **Documenti**: gli 11 PDF sono cifrati in `viaggi/kg2026/docs/*.bin` e si aprono
  dentro la pagina, anche dal telefono e anche senza rete. Il manifest
  pubblico contiene solo numeri di file: né titoli né codici.
- Tema chiaro/scuro automatico secondo le impostazioni del sistema.

## Privacy: i dati sono cifrati

La pagina contiene PIN di Booking, codici di prenotazione e numeri di
telefono. Su GitHub Pages il sito è per forza raggiungibile da chiunque
abbia l'indirizzo, quindi i dati **non vengono pubblicati in chiaro**:

- `viaggi/index.js` e `viaggi/<id>/data.js` — dati leggibili, **restano
  solo sul Mac** (in `.gitignore`)
- `viaggi/index.enc.js` e `viaggi/<id>/data.enc.js` — gli stessi dati
  cifrati con AES-256-GCM, questi sono gli unici che finiscono online
- `js/chiave.js` — se trova i dati in chiaro parte subito (copia sul
  Mac); altrimenti chiede la password, decifra nel browser e parte

La chiave è una sola per tutto: il sale sta in testa a
`viaggi/index.enc.js`, e ogni viaggio e ogni PDF riusano quella chiave con
un vettore diverso. La password si digita una volta per dispositivo e
apre lo scaffale e tutti i viaggi.

Chi apre l'indirizzo senza password vede solo la schermata di sblocco.
La password si digita una volta per dispositivo, poi resta memorizzata.

**Dopo ogni modifica ai dati** va rigenerato il file cifrato:

```
node tools/lock.mjs                   # riusa la password salvata
node tools/lock.mjs --viaggio kg2026  # solo quel viaggio
node tools/lock.mjs "nuova password"  # per cambiarla
```

**Non ricifra quello che non è cambiato**: prima apre il file che c'è e
confronta. Ricifrare a vuoto cambierebbe ogni byte (vettore nuovo) e
produrrebbe commit da megabyte che non dicono niente.

## Le due pagine

| | Indirizzo | Chi la apre |
|---|---|---|
| Scaffale | `/orbit/` | solo voi, con la password |
| Un viaggio | `/orbit/viaggio.html?v=<id>` | solo voi, stessa password |
| Per i cari | `/orbit/pubblico/` | chiunque abbia il link |

La pagina pubblica legge `pubblico/dati.js`, generato da `tools/lock.mjs`
togliendo codici, nomi delle strutture, indirizzi, telefoni e spese. Se
qualcosa di riservato dovesse sfuggire, **la generazione si ferma** invece
di pubblicare.

**Mostra sempre il viaggio più recente fra quelli marcati
`pubblicato:true`**: il link in mano ai parenti non cambia mai, cambia da
solo quello che ci trovano dentro. Le foto del diario stanno in
`pubblico/diario/<id-viaggio>/`, così pubblicare un viaggio nuovo non
cancella quelle del precedente.

Sotto tutto questo c'è una guardia che non conosce la password:
`tools/controlla-pubblico.mjs` cerca nelle pagine pubbliche le forme
delle cose che non devono uscire — telefoni, codici, PIN, indirizzi — e
controlla che nel repository non siano entrati i dati in chiaro o i PDF.
Gira anche su GitHub a ogni push (`.github/workflows/controllo.yml`), ed
è gratis sui repository pubblici.

Foto e note ci arrivano dalla pagina privata: nella scheda Diario si
sceglie cosa mandare e `js/pubblica.js` lo carica in `pubblico/diario/`
tramite l'API di GitHub. Serve una chiave personale (token con permesso
*Contents: read and write* sul solo repository `orbit`), chiesta una
volta e conservata solo sul dispositivo.

## Modificare il viaggio dal telefono

In fondo alla pagina privata c'è la sezione **I dati del viaggio**: mostra
il contenuto di `viaggi/<id>/data.js`, lo lascia correggere e lo rimanda su GitHub
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

Nel repository c'è tutto tranne i dati in chiaro (`viaggi/index.js` e
`viaggi/*/data.js`) e `.orbit-pw` (la password). Non servono: si
ricostruiscono dai file cifrati, che invece sono pubblicati. Su una
macchina qualsiasi:

```
git clone https://github.com/alintitaru-create/orbit
cd orbit
node tools/unlock.mjs "la password"
```

e la copia di lavoro torna completa, con tutti i viaggi. Provato davvero:
da un clone pulito si riottengono 19 luoghi, 23 tratte, 15 giornate, 64
punti, 5 prenotazioni e 11 documenti, identici byte per byte.

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
