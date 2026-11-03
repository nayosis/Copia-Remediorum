---
name: architecture
description: Principes d'architecture des applications auto-hébergées familiales (RPC typé par talons Vite, journal de preuve avant/après, traçabilité par déclencheurs SQLite, conflits d'écriture, mise à jour en direct SSE, rôles lecture/écriture/admin/super admin, sauvegardes, Docker mono-conteneur, notifications Web Push en option), issus du modèle Fundamentum. À charger pour toute question de conception technique, de nouvelle fonctionnalité qui touche aux données, aux droits ou aux fichiers, ou avant de proposer une structure de projet.
---

# Architecture

Les applications de ce modèle sont **petites, auto-hébergées, pour une famille** : quelques utilisateurs, une base de
quelques Mo, un serveur personnel (souvent derrière un reverse proxy HTTPS). On choisit donc **la simplicité et la
preuve** plutôt que la montée en charge. Toute proposition qui ajoute un service (Redis, Postgres, file de messages,
microservice) doit être justifiée par un besoin écrit dans `docs/conception.md`.

## Vue d'ensemble

```
Navigateur (React)                         Serveur Bun (un seul processus, un seul conteneur)
  composant ──import──> src/data/x.ts        Elysia
     (talon généré par Vite)                   ├─ /api/auth/*        cookie de session (httpOnly, SameSite=strict)
        └── POST /api/rpc/:nom {args} ────────>├─ /api/rpc/:nom      droits → contexte → fonction src/data → journal → diffusion
  EventSource /api/evenements <── SSE ─────────├─ /api/evenements    « quelqu'un a modifié » → invalider les requêtes
  upload ── POST /api/fichiers ───────────────>├─ /api/fichiers      fichier sur disque (nom UUID), rattaché ensuite par RPC
                                               ├─ /api/exports/*     PDF / ZIP générés à la demande
                                               ├─ /api/sauvegarde/*  ZIP complet, restauration (super admin)
                                               └─ /*                 front compilé (dist/)
                                             SQLite : data/donnees.db (métier) + data/comptes.db (comptes, sessions)
                                             data/fichiers/ (justificatifs)   data/sauvegardes/ (une par nuit)
```

## Ce qui est générique, ce qui est propre à l'application

Tout `serveur/` est générique **sauf `serveur/modele.ts`** ; côté interface, les écrans du socle (connexion, comptes,
journal, sauvegarde, mise à jour) sont génériques et ne lisent le modèle que par **`src/lib/modele.ts`**. Une
amélioration du socle faite dans une application (hors de ces deux fichiers et du métier) se reporte dans le dépôt
modèle `nayosis/fundamentum`, pour les applications suivantes : le proposer à l'utilisateur quand ça arrive.

## Décisions structurantes

### 1. RPC par talons : une seule définition des fonctions métier
Les fonctions de `src/data/` sont écrites une fois, typées, et **exécutées uniquement sur le serveur**. Dans le
navigateur, un plugin Vite remplace chaque module par des talons `(...args) => rpc("nom", args)`. Les composants
importent les vraies signatures (types conservés), le SQL ne quitte jamais le serveur.
- Pas d'API REST écrite à la main pour le métier ; les routes HTTP dédiées sont réservées aux fichiers, aux exports,
  à l'authentification, aux sauvegardes et au flux d'événements.
- Le registre (`serveur/rpc.ts`) expose tous les modules de `src/data/` sauf `_*.ts`, et classe chaque fonction en
  **lecture** (liste explicite `LECTURES`, `serveur/modele.ts`) ou **écriture** (tout le reste : sûr par défaut).
  Un nom en double, ou une lecture déclarée qui n'existe pas, fait échouer le démarrage.
- Protection CSRF : en-tête `X-<App>: 1` exigé, cookie `SameSite=strict`.

### 2. Contexte de requête et traçabilité automatique
L'utilisateur courant circule par `AsyncLocalStorage` (`contexteRequete`). Avant chaque écriture SQL, l'exécuteur
le recopie dans une table temporaire ; des **déclencheurs SQLite** remplissent `cree_par`, `modifie_par`,
`modifie_le`. Les fonctions métier n'ont rien à faire, et le navigateur ne peut pas falsifier ces colonnes
(`sansTrace`). Hors requête (tests, tâches planifiées), le contexte donne tous les droits.

### 3. Journal de preuve
Chaque écriture RPC est journalisée : qui, quand, quelle fonction, résumé des arguments, et **l'instantané complet de
la fiche avant et après** (JSON, fiche enrichie de ses liens par `enrichir()` dans `serveur/modele.ts`). Le journal
n'est ni modifiable ni effaçable depuis l'application. **Rien n'est effacé physiquement** quand la preuve compte :
on archive (`archive = 1`) et l'objet reste consultable depuis le journal.

### 4. Conflits d'écriture (verrouillage optimiste)
`modifie_le` sert de version. Le navigateur renvoie la version qu'il a lue ; si la fiche a été modifiée **par
quelqu'un d'autre** entre-temps, le serveur lève `Conflit` → HTTP 409 → l'interface affiche « Modifié entre-temps
par X ». Ses propres modifications ne gênent pas.

### 5. Mise à jour en direct
Après chaque écriture, le serveur diffuse un événement SSE `{ par, fonction, client }`. Les autres onglets
invalident toutes leurs requêtes (regroupées sur 400 ms) ; l'onglet auteur, reconnu par son `ID_CLIENT`, s'ignore.
La base étant petite, on recharge tout plutôt que de cibler : plus simple, jamais faux.

### 6. Droits
- Rôles globaux : **lecture** < **écriture** < **admin**, plus un **super admin** (défini dans `.env` ou créé au
  premier lancement). Un admin attribue lecture / écriture ; seul le super admin nomme des admins, restaure une
  sauvegarde, et fait les opérations irréversibles de réparation.
- Invitations et réinitialisations par **lien à usage unique** ; mots de passe argon2id ; limitation des échecs de
  connexion ; jetons de session stockés hachés.
- Les règles fines (« une fiche validée n'est plus modifiable que par un admin ») sont vérifiées **dans la fonction
  métier** (`adminCourant()`), pas dans l'interface : l'interface ne fait que cacher les boutons.

### 7. Fichiers
Envoi en deux temps : `POST /api/fichiers` (contrôle du type et de la taille, nom UUID sur disque) puis rattachement
par la fonction RPC qui crée la fiche (relit type et taille sur le disque). Fichiers immuables → cache long privé.
Les fichiers jamais rattachés sont purgés après 7 jours.

### 8. Téléphone / ordinateur
`useEcran()` est la seule source de vérité. Le téléphone est un **terminal de saisie rapide** ; les écrans denses
(paramètres, exports, comptes, journal, sauvegarde, opérations de validation) sont réservés à l'ordinateur ou à la
tablette et affichent sinon « Cette page s'utilise sur un ordinateur ». Pas de hors ligne sauf décision contraire.

### 9. Exploitation
- Un seul conteneur, un volume `/data` (bases, fichiers, sauvegardes), `HEALTHCHECK` sur `/api/sante`.
- **Verrou d'instance** (`data/instance.verrou`) : un seul serveur par dossier de données.
- Sauvegarde complète chaque nuit (ZIP : bases + fichiers + manifeste), N conservées, téléchargeables et
  restaurables en un clic ; migrations appliquées automatiquement au démarrage.
- Vérification facultative d'une nouvelle version sur GitHub (désactivable).
- Configuration uniquement par variables d'environnement, documentées dans `.env.exemple`.

### 10. Notifications sur téléphone (module facultatif)
Activé seulement si la conception le demande. Le principe : **Web Push** sur l'application installée (PWA,
`manifest.webmanifest` déjà présent), sans service externe ni application native.
- Clés VAPID générées au premier lancement et gardées dans `data/` (donc sauvegardées).
- Table `abonnement_push` (utilisateur, endpoint, clés, appareil, créé le) dans `comptes.db` ; un service worker
  minimal reçoit et affiche la notification, un clic ouvre la page concernée.
- Chaque utilisateur choisit ses notifications dans son profil ; un envoi qui échoue en 404/410 supprime l'abonnement.
- Limites à écrire dans la conception : HTTPS obligatoire ; sur iPhone, l'application doit être **ajoutée à l'écran
  d'accueil** (iOS 16.4+) ; pas de garantie de délai (pas pour de l'urgent).
- Les envois partent d'une tâche planifiée du serveur (comme la sauvegarde de nuit) ou d'une écriture RPC, jamais
  du navigateur.

## Quand on conçoit une nouvelle fonctionnalité

Se poser, et écrire la réponse dans `docs/conception.md` :
1. Quelles **données** (tables, liens, unités) ? Faut-il une migration de valeurs de départ ?
2. **Lecture ou écriture** ? Quel rôle minimal ? Une règle de verrouillage (fiche validée, archivée) ?
3. Que doit montrer le **journal** (l'instantané couvre-t-il les liens utiles) ? Suppression ou archivage ?
4. Modifiée **à plusieurs** → version et conflit ?
5. **Téléphone** ou réservée à l'ordinateur ?
6. Apparaît-elle dans les **exports** / la **sauvegarde** ?
7. Quels **tests** prouvent la règle ?

Si une demande contredit une de ces décisions, le dire et proposer d'abord de mettre à jour la conception.
