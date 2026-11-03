# Conception

Décisions prises au cadrage (<date>). Socle technique et architecture : skills `socle-technique` et `architecture`
(modèle Fundamentum, tiré de Cura Parentum). Patte graphique : <couleur principale> sur <fonds>, pour ne pas confondre avec les autres
applications. Maquettes : <lien ou « à faire »>.

> Mode d'emploi : chaque section se remplit pendant le cadrage (skill `cadrage`). Ce qui n'est pas tranché reste
> marqué **À décider**. Les décisions sont en gras et justifiées. Supprimer ce paragraphe une fois le cadrage fini.

## Le besoin

À décider : qui utilise l'application, dans quelle situation, quel problème elle résout, ce qui se passe aujourd'hui
sans elle. Une histoire concrète en un paragraphe.

## Modèle

```
<Objet principal> ─┬─ <Objet lié> (1)
                   ├─ <Objets liés> (0..n)
                   └─ <Autre objet> (0..1)
```

- **<Objet>** : champs principaux, unités (montants en centimes, dates ISO…), ce qui est obligatoire ou facultatif.
- À décider : suppression ou archivage de chaque objet.
- À décider : valeurs de départ (migration 0001).

## Règles métier

- À décider : ce qui est permis, interdit, verrouillé, irréversible.
- À décider : cas limites (valeurs négatives, oublis, saisies en retard, corrections après validation).

## Fichiers

- À décider : types acceptés, taille maximale, effacement ou archivage.

## Journal (preuve)

- Par défaut (socle) : chaque écriture journalisée, fiche entière avant / après, journal non modifiable.
- À décider : ce que l'instantané doit inclure en plus (liens, fichiers).

## Exports

- À décider : documents à produire (PDF, ZIP, CSV), pour qui, avec quoi dedans.

## Comptes

- Par défaut (socle) : rôles lecture, écriture, admin, super admin ; invitations par lien à usage unique.
- À décider : ce que voit et peut faire chaque rôle dans cette application.

## Téléphone et ordinateur

- Par défaut (socle) : téléphone < 768 px ≤ tablette < 1200 px ≤ ordinateur ; téléphone = saisie rapide.
- À décider : pages réservées à l'ordinateur ; hors ligne ou non.

## Notifications

- Option du socle (Web Push sur l'application installée, cf. skill `architecture` § 10) : **oui / non**.
- À décider : quels événements notifient, qui les reçoit, réglables par chacun ou non.

## Hors V1

- À décider.

## Plan de la V1

1. Socle : infrastructure reprise (comptes, sauvegarde, journal, mise à jour), schéma V1 et valeurs de départ, thème,
   page Paramètres.
2. À décider.
3. À décider.
4. Publication : dépôt `<compte>/<projet>`, image ghcr.io, déploiement sur `<domaine>`.
