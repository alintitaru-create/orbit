# Orbit — istruzioni per chi lavora su questo progetto

Dashboard del viaggio di Alin e Benedetta in Kirghizistan e Uzbekistan,
9–23 settembre 2026. Sono due pagine statiche, senza framework e senza
chiavi API, pubblicate con GitHub Pages.

**Si lavora in italiano**: commenti, messaggi di commit e testi della
pagina. L'utente non è uno sviluppatore: spiegare senza gergo tecnico.

## Le due pagine

| | Indirizzo | Chi la apre |
|---|---|---|
| Privata | https://alintitaru-create.github.io/orbit/ | solo loro, con password |
| Per i cari | https://alintitaru-create.github.io/orbit/pubblico/ | chiunque abbia il link |

## La regola che conta

Il repository è **pubblico**, ma i dati del viaggio contengono PIN di
Booking, codici di prenotazione, telefoni e indirizzi. Perciò:

- `js/data.js` (dati in chiaro) è in `.gitignore`: **non deve mai finire
  in un commit**
- online va solo `js/data.enc.js`, cifrato con AES-256-GCM
- i PDF stanno cifrati in `docs/*.bin`; gli originali non entrano nel repo
- `pubblico/dati.js` è la versione ripulita per i cari

**Prima di iniziare** serve ricostruire i dati in chiaro (chiedere la
password all'utente, non è scritta da nessuna parte nel repo):

```
node tools/unlock.mjs "LA-PASSWORD"
```

**Dopo ogni modifica a `js/data.js`**, senza eccezioni:

```
node tools/lock.mjs
```

che rigenera `js/data.enc.js`, `docs/*.bin` e `pubblico/dati.js`. Se
dimenticato, le pagine online restano indietro.

## Struttura a settori

Ogni file fa una cosa sola; per cambiare qualcosa si tocca un file solo.
La mappa completa è in `README.md`, tabella «Struttura a settori».
In breve: `css/tokens.css` = tutti i colori; `js/data.js` = tutti i
contenuti del viaggio; `js/*.js` = un settore per funzione;
`pubblico/` = la pagina dei cari.

## Cosa non deve mai succedere

- dati riservati nella pagina pubblica: la ripulitura sta in
  `js/sanifica.js`, **un file solo** usato sia da `tools/lock.mjs` sia
  dal telefono. Non duplicarla: se le due strade divergono, finiscono
  dati riservati su una pagina pubblica. Il file si ferma da solo se
  trova codici, telefoni, cognomi o nomi di strutture nel risultato.
- commit di `js/data.js`, `.orbit-pw`, o di PDF
- servizi a pagamento o chiavi API: mappe, meteo e cambi sono tutti
  gratuiti e senza registrazione

## Verificare prima di dire che funziona

Le pagine si rompono in modi che i test sul codice non vedono (un pannello
invisibile, una mappa che non si disegna). Aprire davvero il sito in un
browser e **guardare** il risultato prima di dichiararlo a posto.

## Da telefono, senza computer

L'utente può già fare da solo, dalla pagina privata: aggiungere foto e
video, scrivere il diario, pubblicare ai cari, e modificare i dati del
viaggio dalla sezione «I dati del viaggio». Serve il computer soltanto
per ricifrare i PDF dei documenti, che stanno sul suo Mac.
