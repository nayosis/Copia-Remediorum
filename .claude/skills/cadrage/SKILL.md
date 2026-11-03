---
name: cadrage
description: Mène l'entretien de cadrage d'un nouveau projet ou d'une nouvelle grande fonctionnalité, et rédige ou met à jour docs/conception.md. À charger quand l'utilisateur veut « discuter », « cadrer », « concevoir », lancer un nouveau projet, ou quand docs/conception.md est vide ou contient encore des « À décider ».
---

# Cadrage → docs/conception.md

But : sortir de la discussion avec un `docs/conception.md` dans lequel **chaque décision est écrite**, pour qu'une
future session (sans mémoire de cette conversation) puisse coder sans redemander.

## Déroulé

1. **Lire** `docs/conception.md` (gabarit ou version en cours) et `CLAUDE.md`. Repérer les sections vides et les
   lignes `À décider`.
2. **Questionner par petits lots** (3 à 5 questions à la fois, pas un questionnaire de 40 lignes), dans cet ordre :
   1. Le besoin : qui, quelle situation, quel problème, que se passe-t-il aujourd'hui sans l'outil ?
   2. Les utilisateurs et leurs rôles (qui saisit, qui consulte, qui administre).
   3. Les objets manipulés et leurs liens (→ section Modèle), unités et formats.
   4. Les règles métier : ce qui est permis, interdit, verrouillé, irréversible ; les cas limites.
   5. Les sorties : écrans clés, exports, documents à remettre à un tiers.
   6. Téléphone / ordinateur, hors ligne, notifications.
   7. Ce qui est **hors V1**.
   8. Le plan de la V1 en étapes livrables.
3. Pour chaque question, **proposer une réponse par défaut** tirée du socle (skills `architecture` et
   `socle-technique`) : l'utilisateur valide ou corrige, c'est plus rapide qu'une page blanche.
4. **Écrire au fil de l'eau** dans `docs/conception.md` après chaque lot validé, au style du gabarit : phrases
   courtes, décisions en **gras**, raisons données (« pas de HEIC : … »), exemples concrets (« CB Patrick »).
5. Ce qui n'est pas tranché reste marqué `À décider : …` — jamais inventé.
6. À la fin : relire avec l'utilisateur les contradictions avec le socle, puis proposer la première étape du plan.

## Règles

- Une décision = une phrase dans le document, datée si elle change une décision antérieure (« (0.3) » ou
  « Décidé le … »).
- Ne pas écrire de code pendant le cadrage, sauf demande explicite.
- Le vocabulaire choisi ici (noms des objets, des statuts) devient celui du code : le fixer tôt, en français.
