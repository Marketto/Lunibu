---
name: verify-content
description: Run an independent evidence check on changed content files (cards, games, sources) using the evidence-verifier agent. Use after any edit to content/.
---
# Verifica indipendente

1. Elenca i file/elementi cambiati: `git diff --name-only -- content/` e gli id toccati.
2. Lancia l'agente `evidence-verifier` passando SOLO gli id cambiati e i percorsi dei file (non incollare il contenuto:
   meno token). Chiedi la classificazione di ogni frase (a/b/c, regola 0) e l'output: problema → correzione IT/RU/EN → URL.
3. Applica tutti i "must fix" (incluse le frasi (b)/(c): riscrivi dalla fonte o elimina) e i "minor fixes" condivisibili; poi `npm run content && npm test`.
4. Se le correzioni hanno cambiato dati di ricerca, ripeti la verifica sugli elementi corretti.
