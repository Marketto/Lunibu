---
name: add-content
description: Add or update an evidence-based card (content/cards) or game (content/games.json) in Lunibù, with mandatory independent verification. Use whenever research data is created or changed.
---
# Aggiungere/aggiornare contenuti

**Regola 0: non creiamo contenuti, riportiamo quelli autorevoli.** Ogni frase (anche consigli, esempi, riassunti) deve
essere detta da una fonte verificata; senza fonte il tema si omette o si dichiara "nessuna fonte autorevole".
I temi suggeriti dall'utente sono esempi da cercare. Eccezione: musiche/suoni e istruzioni di gioco confezionati da
descrizioni accurate delle fonti, senza affermazioni di beneficio aggiunte.

1. **Fonti** → agente `source-researcher` (sonnet): restituisce record JSON con citazione, DOI/URL, età, risultati.
2. **Verifica fonti** → agente `evidence-verifier` (opus, high): conferma esistenza, numeri, età. Scarta i "must fix".
3. Aggiungi le fonti a `content/sources.json` (id univoco non già usato; `type` scelto tra quelli già presenti nel file, es. «linea guida», «meta-analisi», «revisione sistematica», «studio osservazionale»; prima controlla che la fonte non ci sia già con un altro id).
4. **Scrittura IT** → agente `content-writer`: schema delle schede esistenti; voci per età `{"t","from","to"}`;
   soglie di sicurezza `"strict": true`; possibili patologie → campo `alert`.
5. **Traduzione** → agenti `translator-ru` e `translator-en` (in sequenza sullo stesso file).
6. `npm run content` (schema, fonti, allineamento it/ru/en, fasce 0–144 mesi).
7. **Verifica testo** → `evidence-verifier` su IT+RU+EN contro le fonti, frase per frase. Applica le correzioni e ripeti 6–7 finché OK.
8. `npm test` e screenshot con `qa-runner`.

Regola: ogni trasformazione dei dati (anche solo riformulare o cambiare una fascia d'età) richiede il passo 7.
Nel passo 7 il verificatore classifica ogni frase (a) detta dalla fonte / (b) aggiunta / (c) senza fonte:
(b) e (c) sono must fix e si correggono riscrivendo dalla fonte o eliminando, mai etichettandoli.
