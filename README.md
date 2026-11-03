<p align="center">
  <img src="public/icone.svg" alt="" width="96" height="96">
</p>

<h1 align="center">Copia Remediorum</h1>

<p align="center">
  <em>La fondation</em> — socle d'application familiale auto-hébergée, logiciel libre.
</p>

Le point de départ des applications de la même famille ([Custos Domus](https://github.com/nayosis/custos-domus),
[Cura Parentum](https://github.com/nayosis/cura-parentum)…) : tout ce qui ne dépend pas du métier, prêt à l'emploi, et
un petit module d'exemple (des notes avec pièces jointes) qui montre chaque mécanisme.

## Ce que le socle apporte

- **Comptes** : rôles lecture, écriture, admin ; super admin défini dans `.env` ou créé au premier lancement ;
  invitations et réinitialisations par lien à usage unique ; mots de passe argon2id.
- **Fonctions métier par RPC** : écrites une fois dans `src/data/`, exécutées sur le serveur, appelées depuis
  l'interface comme des fonctions ordinaires (typées).
- **Journal de preuve** : chaque écriture, par qui, quand, la fiche entière avant et après ; historique par fiche.
- **Traçabilité** automatique (créé / modifié par, le) et **conflits d'écriture** signalés (« modifié entre-temps par… »).
- **Mise à jour en direct** des autres navigateurs ouverts.
- **Fichiers** (photos, PDF) et **sauvegardes** : une complète chaque nuit, téléchargeable et restaurable en un clic.
- **Téléphone et ordinateur** : interface adaptée, application installable (PWA).
- **Docker** : une image multi-architecture publiée sur ghcr.io à chaque version.

## Démarrer une nouvelle application

1. Sur GitHub, **Use this template** → nouveau dépôt.
2. Puis :

```bash
bun install
bun scripts/renommer.ts "Nom Affiché" compte/depot "Ce que fait l'application, en une phrase."
```

3. Choisir sa couleur et son logo (`src/theme.ts`, `src/components/Logo.tsx`, `public/icone.svg`, puis
   `bun scripts/icones.ts`).
4. Cadrer avec Claude (« on cadre le projet ») : `docs/conception.md` se remplit au fil de la discussion.

## Travailler avec Claude

```
CLAUDE.md                                ← lu à chaque session : règles, où trouver quoi, étape en cours
docs/conception.md                       ← le QUOI : besoin, modèle, règles métier, plan (propre à l'application)
.claude/skills/cadrage/SKILL.md          ← comment mener la discussion qui remplit conception.md
.claude/skills/architecture/SKILL.md     ← principes techniques communs
.claude/skills/socle-technique/SKILL.md  ← pile, conventions, recettes pas à pas
```

Claude ne garde aucune mémoire d'une session à l'autre : ce qui doit durer s'écrit dans le dépôt. `CLAUDE.md` est
lu en entier à chaque session (il reste court) ; d'un skill, seule la description est lue au départ, le reste quand
la tâche s'y rapporte. *Réutilisable* → skill ; *propre à l'application* → conception.md ; *à savoir à chaque
session* → CLAUDE.md.

## Développement

```bash
bun install
cp .env.exemple .env      # puis choisir le super admin de développement
bun run dev               # interface : http://localhost:5183 (API sur le port 3220)
bun test
bun run type-check
bun run db:generate       # après modification de src/db/schema.ts → nouvelle migration dans drizzle/
```

Bun + Elysia + SQLite (Drizzle) côté serveur, React + Mantine + TanStack côté interface.

## Installer (Docker)

```bash
mkdir copia-remediorum && cd copia-remediorum
curl -O https://raw.githubusercontent.com/nayosis/copia-remediorum/main/docker-compose.yml
docker compose up -d
```

Puis ouvrir `http://<serveur>:3000` : le premier compte créé est l'administrateur principal. Réglages facultatifs :
[.env.exemple](.env.exemple) ; derrière un reverse proxy HTTPS : [docker/nginx-exemple.conf](docker/nginx-exemple.conf).

## Licence

[AGPL-3.0-or-later](LICENSE).
