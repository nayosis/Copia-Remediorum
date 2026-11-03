---
name: socle-technique
description: Socle technique commun aux applications auto-hébergées (Bun, Elysia, SQLite/Drizzle, React 19, Mantine, TanStack Router/Query, pdf-lib, Docker), issu du modèle Fundamentum (lui-même tiré de Cura Parentum et Custos Domus). À charger dès qu'on écrit ou modifie du code, ajoute une dépendance, une migration, un test, une page ou une fonction métier, ou qu'on prépare une version.
---

# Socle technique

Dépôt modèle : https://github.com/nayosis/fundamentum (socle seul, avec un module d'exemple « notes »).
Application complète de référence : https://github.com/nayosis/cura-parentum. En cas de doute sur la façon de faire,
regarder comment Cura Parentum le fait, et faire pareil.

## Pile

| Couche | Choix | Remarques |
|---|---|---|
| Exécution | **Bun 1.3** (pas Node) | `bun install`, `bun test`, `Bun.password` (argon2id), `bun:sqlite`, `Bun.file` |
| Serveur HTTP | **Elysia** | validation des corps avec `t.Object(...)` |
| Base | **SQLite** (`bun:sqlite`, WAL, `foreign_keys = ON`) | une base métier `donnees.db` + une base `comptes.db` séparée |
| ORM | **Drizzle** en mode `sqlite-proxy` + SQL brut quand c'est plus clair | migrations `drizzle-kit generate` |
| Interface | **React 19** + **Mantine 9** + `@tabler/icons-react` | couleur `marque` propre à chaque application (`src/theme.ts`) |
| Routage / données | **TanStack Router** (routes en code) + **TanStack Query** | `staleTime: Infinity`, on invalide tout après chaque écriture |
| Build | **Vite** | plugin maison qui remplace `src/data/*` par des talons RPC |
| Dates | **dayjs**, chaînes ISO `AAAA-MM-JJ` en base | fuseau fixé par `TZ` (Europe/Paris) |
| PDF / ZIP | **pdf-lib** (version figée), **fflate** | |
| Livraison | **Docker** multi-arch sur ghcr.io, `docker-compose.yml` à la racine | volume `/data` |
| Licence | AGPL-3.0-or-later | |

Ne pas ajouter de dépendance sans la proposer d'abord (une ligne : pourquoi, et pourquoi le socle ne suffit pas).

## Conventions de code

- **Tout en français** : identifiants (`creerDepense`, `ficheRemboursement`, `verifierSaisie`), fichiers, commentaires,
  messages d'erreur, commits, CHANGELOG. Seuls les mots imposés par les bibliothèques restent en anglais.
- Commentaires : une docstring `/** … */` courte qui dit **pourquoi**, pas ce que fait la ligne. Les décisions
  surprenantes (pas de HEIC, pas de `crypto.randomUUID` côté client en HTTP…) sont expliquées là où elles s'appliquent.
- **Montants en centimes** (entiers), partout. Dates en chaînes ISO. Identifiants : UUID (`newId()`).
- Erreurs métier : `throw new ErreurMetier("Message lisible par l'utilisateur.", statut?)` — le message est affiché
  tel quel dans l'interface, il doit donc être une phrase française correcte.
- TypeScript strict, deux `tsconfig` (interface et serveur) : `bun run type-check` doit passer.
- Pas de formateur imposé, mais rester dans le style existant : lignes longues acceptées (~160), guillemets doubles,
  points-virgules.

## Arborescence

```
serveur/          Elysia : app.ts (routes), auth.ts, comptes.ts, base.ts (ouverture, migrations, verrou),
                  rpc.ts (registre des fonctions), journal.ts, tracabilite.ts, evenements.ts (SSE),
                  sauvegarde*.ts, pdf.ts (rédacteur de PDF), config.ts (variables d'environnement), index.ts, dev.ts
serveur/modele.ts ★ ce que le socle doit savoir du modèle : LECTURES, TABLES_SUIVIES, COMPTEURS, enrichir()…
src/data/         Fonctions métier (exécutées sur le serveur, appelées par RPC depuis le navigateur) ;
                  _*.ts = outils réservés au serveur (_commun.ts, _version.ts), jamais exposés
src/db/           schema.ts (Drizzle), client.ts (exécuteur injecté)
src/lib/          Outils purs partagés (dates, montants, documents) + côté client (rpc, query, session, ecran, fichiers)
src/lib/modele.ts ★ pendant côté interface : libellés des fonctions et des champs du journal
src/pages/        Une page par route ; src/components/ pour le réutilisable
drizzle/          Migrations SQL numérotées (0000_init.sql, 0001_valeurs.sql…) + meta/
tests/            bun test ; preparation.ts (dossier temporaire), outils-serveur.ts (serveur en mémoire)
scripts/          renommer.ts (nouvelle application), icones.ts (PNG depuis public/icone.svg)
docs/             conception.md
```

Le module d'exemple (`src/data/notes.ts`, `src/pages/Notes.tsx`, `FicheNote.tsx`, `components/ModalNote.tsx`,
`tests/notes.test.ts`, tables `note` et `piece_jointe`) montre chaque mécanisme : s'en inspirer, puis le remplacer.

## Recettes

### Démarrer une nouvelle application depuis le modèle
1. GitHub : « Use this template » sur le dépôt modèle `nayosis/fundamentum` → nouveau dépôt.
2. `bun install && bun scripts/renommer.ts "Nom Affiché" compte/depot "Description en une phrase."`
3. Couleur `marque` (`src/theme.ts`, `public/icone.svg`, `theme_color` de `index.html` et du manifeste), logo
   (`src/components/Logo.tsx`), puis `bun scripts/icones.ts`.
4. Cadrage (skill `cadrage`) → `docs/conception.md` ; puis remplacer le module d'exemple étape par étape.

### Ajouter une fonction métier
1. L'écrire dans `src/data/<module>.ts`, `export async function nomEnFrancais(...)`. Tout module de `src/data/` est
   exposé automatiquement (sauf `_*.ts`) : un outil interne au serveur va dans `_commun.ts` ou un autre `_*.ts`.
2. Si elle **ne modifie rien**, ajouter son nom à `LECTURES` dans `serveur/modele.ts` ; sinon elle est une écriture
   (rôle écriture exigé, journalisée, diffusée aux autres navigateurs).
3. Son libellé dans `LIBELLES_FONCTIONS` (`src/lib/modele.ts`), pour le journal.
4. Contrôler les entrées au début (`verifierSaisie`…), regrouper les écritures liées dans un seul `batch([...])`
   (une transaction).
5. Le premier argument UUID désigne la fiche visée (le journal s'en sert pour l'instantané avant / après) ;
   une création renvoie l'id créé.
6. Fiche modifiable à plusieurs : accepter la version connue (`modifieLe`) et appeler `verifierVersion(...)`
   (`src/data/_version.ts`) ; renvoyer `versionDe(...)`.

### Modifier le schéma
1. Modifier `src/db/schema.ts` (colonnes en `snake_case` côté SQL, `camelCase` côté TS ; `...tracabilite()` sur
   toute table métier).
2. La déclarer dans `serveur/modele.ts` : `TABLES_SUIVIES`, `TABLES_ATTENDUES`, `COMPTEURS`, `enrichir()` (liens à
   montrer dans le journal), `LIENS_JOURNAL` (colonne vers la fiche parente), `REQUETE_FICHIERS_CITES` si elle a des
   fichiers ; ses champs dans `LIBELLES_CHAMPS` (`src/lib/modele.ts`).
3. `bun run db:generate` → nouvelle migration dans `drizzle/`. Les valeurs de départ vont dans une migration SQL.
4. Les migrations sont appliquées au démarrage ; ne jamais modifier une migration déjà publiée.
5. Le signaler dans la rubrique « Mise à jour » du CHANGELOG.

### Ajouter une page
- Route dans `src/router.tsx` (filtres dans l'adresse via `validateSearch`), garde de rôle dans `beforeLoad`.
- Page dense → l'envelopper avec `surOrdinateur(Page, "Titre")`.
- Lecture : `useQuery({ queryKey: [...], queryFn: () => fonctionMetier(...) })`.
- Écriture : `await ecrire(() => fonctionMetier(...))` (rafraîchit tout, affiche l'erreur, gère le conflit 409).
- Lien dans le menu : `ENTREES` de `src/components/Layout.tsx` (`barre: true` pour la barre du téléphone, 3 au plus).
- Saisie rapide (bouton « + » du téléphone) : `src/lib/saisie.tsx`.
- Adapter à l'écran avec `useEcran()` uniquement (téléphone < 768 ≤ tablette < 1200 ≤ ordinateur).

### Tests
- `bun test` ; chaque fichier crée `serveurDeTest()` (bases `:memory:`, super admin) et passe **par l'API**
  (`s.rpc(nom, args, cookie)`), droits compris. Les tests ne touchent jamais `./data`.
- Toute règle métier de `docs/conception.md` a au moins un test ; tout bug corrigé reçoit un test qui le reproduit.
- Avant de dire « fini » : `bun run type-check && bun test`.

### Développement
```bash
bun install
cp .env.exemple .env
bun run dev          # interface :5183, API :3220 (proxy Vite /api)
```
Deux applications du modèle ne tournent pas en même temps en développement : mêmes ports (changer ceux de
`vite.config.ts` et `serveur/dev.ts` dans l'application concernée si besoin).

### Publier une version
1. Version dans `package.json`, entrée dans `CHANGELOG.md` (titre « vX.Y.Z · Résumé », rubriques **Nouveau**,
   **Changé**, **Corrigé**, **Droits**, **Mise à jour**), écrite pour l'utilisateur, pas pour le développeur.
2. Étiquette `vX.Y.Z` identique à `package.json` → workflow `publication.yml` : tests, image ghcr.io, release.
3. Ne jamais pousser d'étiquette sans accord explicite.
