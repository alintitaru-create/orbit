# Orbit — istruzioni per chi lavora su questo progetto

L'applicazione dei viaggi di Alin e Benedetta: quelli fatti restano,
quelli da fare si organizzano. Pagine statiche, senza framework e senza
chiavi API, pubblicate con GitHub Pages.

**Si lavora in italiano**: commenti, messaggi di commit e testi della
pagina. L'utente non è uno sviluppatore: spiegare senza gergo tecnico.

## Le pagine

| | Indirizzo | Chi la apre |
|---|---|---|
| Scaffale | https://alintitaru-create.github.io/orbit/ | solo loro, con password |
| Un viaggio | `…/orbit/viaggio.html?v=<id>` | solo loro, stessa password |
| Per i cari | https://alintitaru-create.github.io/orbit/pubblico/ | chiunque abbia il link |

Lo scaffale (`index.html`) è la prima schermata: i viaggi in corso, in
arrivo e i ricordi, più la lavagna delle idee. Il viaggio aperto
(`viaggio.html`) è la pagina piena — giornate, mappa, diario, soldi.

**La pagina dei cari mostra sempre il viaggio più recente pubblicato**,
quello con `pubblicato:true` nell'elenco. Il link condiviso non cambia
mai: cambia da solo il contenuto.

## La regola che conta

Il repository è **pubblico**, ma i dati dei viaggi contengono PIN di
Booking, codici di prenotazione, telefoni e indirizzi. Perciò:

- `viaggi/index.js` (elenco e idee) e `viaggi/<id>/data.js` (i dati di
  un viaggio) sono in `.gitignore`: **non devono mai finire in un commit**
- online vanno solo le versioni cifrate con AES-256-GCM:
  `viaggi/index.enc.js` e `viaggi/<id>/data.enc.js`
- i PDF stanno cifrati in `viaggi/<id>/docs/*.bin`; gli originali non
  entrano nel repository
- `pubblico/dati.js` è la versione ripulita per i cari

**La chiave è una sola.** Il sale sta in testa a `viaggi/index.enc.js`;
ogni viaggio e ogni PDF riusano quella chiave con un vettore diverso.

**Prima di iniziare** servono i dati in chiaro (chiedere la password
all'utente, non è scritta da nessuna parte nel repo):

```
node tools/unlock.mjs "LA-PASSWORD"
```

**Dopo ogni modifica ai dati**, senza eccezioni:

```
node tools/lock.mjs                   # tutto
node tools/lock.mjs --viaggio kg2026  # solo un viaggio
```

Non ricifra quello che non è cambiato, quindi si può rilanciare senza
paura di commit enormi. Se dimenticato, le pagine online restano indietro.

## Struttura a settori

Ogni file fa una cosa sola; per cambiare qualcosa si tocca un file solo.
La mappa completa è in `README.md`, tabella «Struttura a settori».
In breve: `css/tokens.css` = tutti i colori; `viaggi/<id>/data.js` = tutti
i contenuti di un viaggio; `js/*.js` = un settore per funzione;
`pubblico/` = la pagina dei cari.

Due settori nuovi tengono insieme il resto:

- `js/chiave.js` — la password, la chiave, i file cifrati. **La
  cifratura sta qui e solo qui**, sia per il Mac sia per il telefono.
- `js/viaggi.js` — `Viaggi` è lo scaffale, `Viaggio` è quello aperto.
  **Ogni cosa salvata nel browser passa da `Viaggio.chiave(nome)`** e
  ogni file del viaggio da `Viaggio.file(percorso)`: senza, i dati di un
  viaggio finiscono addosso a quelli di un altro.

## Cosa non deve mai succedere

- dati riservati nella pagina pubblica: la ripulitura sta in
  `js/sanifica.js`, **un file solo** usato sia da `tools/lock.mjs` sia
  dal telefono. Non duplicarla: se le due strade divergono, finiscono
  dati riservati su una pagina pubblica. Il file si ferma da solo se
  trova codici, telefoni, cognomi o nomi di strutture nel risultato.
  La rete di sicurezza sotto è `tools/controlla-pubblico.mjs`, che gira
  anche su GitHub a ogni push e non conosce la password.
- commit di `viaggi/index.js`, `viaggi/*/data.js`, `.orbit-pw`, o di PDF
- servizi a pagamento o chiavi API: mappe, meteo e cambi sono tutti
  gratuiti e senza registrazione
- dati di un viaggio scritti a mano dentro il codice: niente valute,
  paesi o date fissi nei settori. Le valute le dichiarano i gruppi di
  `BUDGET` (campo `cur`), le fasi le dicono le date.

## Verificare prima di dire che funziona

Le pagine si rompono in modi che i test sul codice non vedono (un pannello
invisibile, una mappa che non si disegna). Aprire davvero il sito in un
browser e **guardare** il risultato prima di dichiararlo a posto — sia lo
scaffale sia un viaggio, e sia la copia sul Mac (dati in chiaro) sia una
copia senza i file in chiaro, che è come si comporta online.

Attenzione a una trappola: il service worker serve dalla cache, quindi
dopo una modifica il primo ricaricamento può ancora mostrare il file
vecchio. Ricaricare due volte, o partire da un profilo pulito.

## Da telefono, senza computer

L'utente può già fare da solo, dalla pagina privata: creare un viaggio
nuovo e aggiungere idee dallo scaffale, aggiungere foto e video,
scrivere il diario, pubblicare ai cari, e modificare i dati del viaggio
dalla sezione «I dati del viaggio». Serve il computer soltanto per
cifrare i PDF dei documenti, che stanno sul suo Mac.
