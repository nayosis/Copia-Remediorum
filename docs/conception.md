# Conception

Cadrage commencé le 3 novembre 2026. Socle technique et architecture : skills `socle-technique` et `architecture`
(modèle Fundamentum, tiré de Cura Parentum). Patte graphique : **vert sauge** sur fonds crème, logo gélule, pour ne pas
confondre avec Custos Domus (terre cuite) et Cura Parentum (prune). Maquettes : à faire.

## Le besoin

Une personne (l'aidante) gère les médicaments de ses parents âgés. Le but **n'est pas** de cocher chaque prise :
c'est de **savoir à quel moment contacter le médecin** pour faire renouveler tel ou tel médicament, avant d'en manquer.
Elle note la posologie de chaque médicament pour chaque personne et compte le stock à une date ; l'application calcule
le stock restant et la date à laquelle il sera épuisé. De nouveaux **pointages** (comptage) recalent le calcul en cas
d'oubli de prise, de boîte perdue ou de nouvelles boîtes.

## Modèle

```
Personne ── Traitement (0..n) ──┬─ Médicament
               └─ Posologie     └─ Stock (réserve) ── Pointages (0..n)
```

- **Personne** : prénom (« Jeanne », « Robert »).
- **Médicament** : nom (« Kardégic 75 mg »), unité (comprimé, gélule, sachet…).
- **Traitement** : un médicament pris par une personne, avec sa posologie, une date de début, une date de fin
  facultative, et un délai d'alerte facultatif (sinon celui des paramètres).
- **Stock** (réserve) : **les deux cas sont prévus** (décidé). Un stock est soit **partagé** (l'armoire commune : les
  traitements des deux parents pour ce médicament y puisent), soit **propre à une personne** (ses boîtes à elle).
  **Un traitement puise dans le stock propre à sa personne s'il existe, sinon dans le stock partagé du médicament**
  (décidé) ; on choisit partagé ou propre à la création du stock.
- **Quantités** : en unités du médicament (comprimés). Les posologies admettent ½ et ¼ : quantités stockées en
  **entiers de quarts d'unité** (comme les centimes de Cura), jamais de flottants. Un pointage peut compter des
  demi-comprimés (« 12,5 ») (décidé).

## Posologie

- **Moments** : matin, midi, soir, coucher, chacun avec sa quantité (¼, ½, 1, 2…).
- **Rythme** : tous les jours, un jour sur N, ou certains jours de la semaine.
- **Temporaire** : date de fin facultative ; après elle, plus de consommation.
- **Sans posologie** (« si douleur », dose variable) : pas de consommation calculée ; le stock n'est connu que par
  les pointages (décidé : pas de « consommation estimée par semaine »). Leur alerte est un **seuil en unités choisi
  par l'utilisateur sur le médicament** (« prévenir sous 10 comprimés ») (décidé) : alerte dès qu'un pointage
  descend sous ce seuil.

## Règles du stock

- **Stock estimé** à une date = dernier pointage − consommation théorique de tous les traitements qui y puisent depuis
  ce pointage. **On pointe le soir, après les prises du jour : la consommation reprend le lendemain** (décidé).
- **Date d'épuisement** = premier jour où le stock estimé ne couvre plus les prises du jour.
- **Alerte** : **7 jours** avant la date d'épuisement par défaut (paramètre général), **surchargeable par traitement**
  (médicament × personne). Un stock partagé alerte au plus grand délai de ses traitements.
- **Seul le stock déclenche l'alerte** (décidé) : pas de suivi de l'ordonnance (validité, renouvellements) en V1.
- **Un seul mouvement en V1 : le pointage** (décidé), en nombre d'unités. Nouvelles boîtes, boîte perdue, oubli de
  prise : on recompte. Pas de date de péremption.
- Un pointage se corrige (admins) ; il reste au journal avec la fiche avant / après.

## Fichiers

- **Pas de fichiers en V1** (ni ordonnance ni photo de boîte) : la gestion des fichiers du socle reste en place,
  inutilisée.

## Journal (preuve)

- Par défaut (socle) : chaque écriture journalisée, fiche entière avant / après, journal non modifiable.

## Exports

- **Une page « À renouveler »** (décidé) : les médicaments en alerte, par personne, avec la date d'épuisement
  estimée et le stock du dernier pointage. Pas de PDF ni d'export en V1.

## Comptes

- Socle : rôles lecture, écriture, admin, super admin ; invitations par lien à usage unique.
- **D'autres comptes sont possibles** (famille, aide à domicile) ; **les droits sont gérés par les admins et le super
  admin** (décidé), comme dans le socle.

## Téléphone et ordinateur

- Socle : téléphone < 768 px ≤ tablette < 1200 px ≤ ordinateur.
- **Le pointage se fait sur téléphone** (décidé) : devant l'armoire, saisie rapide (bouton « + » : choisir le stock,
  taper le nombre). La page « À renouveler » se lit aussi sur téléphone.
- **Posologies, médicaments, personnes et paramètres : sur ordinateur ou tablette** (décidé).

## Notifications

- **Oui** (décidé), avec le module Web Push du socle (skill `architecture`, § 10) : « Kardégic de Jeanne : épuisé vers
  le 28 nov., à renouveler », **le jour où l'alerte commence, puis une fois par semaine** tant qu'aucun pointage ne
  repousse la date d'épuisement au-delà du délai d'alerte.
- Chaque compte active les notifications sur son téléphone (application installée sur l'écran d'accueil, HTTPS).
- Module à écrire pour cette application, puis à reporter dans le modèle Fundamentum.

## Hors V1

- Suivi des prises une par une (ce n'est pas le but).
- Ordonnances (validité, renouvellements restants).
- Entrée « +N boîtes » distincte du pointage, dates de péremption.
- Consommation estimée par semaine pour les doses variables.

## Plan de la V1

1. Socle (fait) : dépôt créé depuis le modèle Fundamentum, renommé, couleur et logo.
2. Référentiel : personnes, médicaments (unité, seuil d'alerte), traitements et posologies, paramètres (délai
   d'alerte général : 7 jours) ; le module d'exemple « notes » est retiré.
3. Stocks et pointages : stocks partagés ou propres, pointage sur téléphone (saisie rapide), calcul du stock estimé
   et de la date d'épuisement (fonctions pures, très testées : rythmes, quarts, dates de fin, stock partagé).
4. « À renouveler » : la page (accueil de l'application), par personne, et la fiche de chaque stock (pointages,
   consommation, historique).
5. Notifications : module Web Push (abonnement par compte, tâche quotidienne du serveur, rappel hebdomadaire).
6. Publication : version 1.0, image ghcr.io, déploiement personnel.
