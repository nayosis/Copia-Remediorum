# Fundamentum

Socle d'application familiale auto-hébergée (comptes, journal de preuve, sauvegardes, Docker), avec un module
d'exemple « notes » à remplacer.

## À lire avant de travailler

- `docs/conception.md` : le besoin et **toutes les décisions** fonctionnelles. Elle fait foi : si une demande la
  contredit, le signaler et proposer de la mettre à jour d'abord.
- Skills du projet (`.claude/skills/`) :
  - `cadrage` : pour discuter et remplir / faire évoluer la conception ;
  - `architecture` : principes (RPC, journal, droits, fichiers, sauvegardes, notifications) ;
  - `socle-technique` : pile, conventions, recettes (nouvelle application, fonction métier, migration, page, test, version).
- Dépôt modèle du socle : https://github.com/nayosis/fundamentum — application complète de référence :
  https://github.com/nayosis/cura-parentum. En cas de doute, faire comme Cura Parentum.

## Règles de travail

- Tout en **français** : code, commentaires, messages, commits, CHANGELOG.
- Le métier tient dans `src/data/`, `src/db/schema.ts`, `src/pages/`, `src/components/`, et deux fichiers de
  liaison : `serveur/modele.ts` et `src/lib/modele.ts`. Le reste est le socle commun : une amélioration du socle se
  signale, pour être reportée dans le dépôt modèle.
- Avant de dire qu'une tâche est finie : `bun run type-check && bun test`.
- Une règle métier nouvelle → elle s'écrit dans `docs/conception.md` **et** elle a un test.
- Pas de nouvelle dépendance, pas de push, pas d'étiquette de version sans accord.
- Réponses courtes ; proposer une option recommandée plutôt qu'une liste de possibilités.

## Commandes

```bash
bun install
bun run dev          # interface http://localhost:5183, API :3220
bun test
bun run type-check
bun run db:generate  # après modification de src/db/schema.ts
bun scripts/renommer.ts "Nom" compte/depot "Description"   # une fois, dans une nouvelle application
```

## État

Modèle du socle (v0.1.0). Dans une nouvelle application : remplacer cette ligne par l'étape en cours du plan de la V1.
