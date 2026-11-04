# Journal des versions

## À venir

**Nouveau**
- **Modifier un stock** (fiche du stock, bouton « Modifier ») : le passer de partagé à propre à une personne, ou
  l'inverse ; les traitements suivent.

**Changé**
- Nouveau stock : le champ « Boîtes de » n'est plus prérempli (« partagé ») ; il faut le choisir.

## v0.1.0 · Première version

Suivi du stock de médicaments de la famille : posologies, pointages, date d'épuisement, page « À renouveler » et
notifications sur le téléphone.

**Nouveau**
- Socle repris du modèle Fundamentum 0.1.0 : comptes, journal, sauvegardes, Docker. Couleur vert sauge, logo gélule.
- **Traitements** : pour chaque personne, ses médicaments et leur posologie (matin, midi, soir, coucher, par quart de
  comprimé ; tous les jours, un jour sur N ou certains jours ; date de fin pour un traitement temporaire ; « sans
  posologie » pour un médicament pris si besoin), avec un délai d'alerte propre si besoin.
- **À renouveler** (accueil) : par personne, ce qu'il faut demander au médecin, avec l'échéance ; stocks jamais pointés,
  prochaines échéances ; imprimable.
- **Notifications sur le téléphone** : le jour où un médicament entre dans son délai d'alerte, puis une fois par
  semaine tant qu'il n'est pas renouvelé (à activer dans le menu du compte, appareil par appareil).
- **Stocks** : partagés (l'armoire commune) ou propres à une personne ; pour chacun, le stock estimé ce soir, la date
  d'épuisement et le moment de renouveler (délai d'alerte, ou seuil du médicament). Fiche d'un stock : qui y puise, ses
  pointages avec l'écart au calcul, son historique.
- **Pointage** : bouton « + » du téléphone, on compte ce qui reste le soir ; « Enregistrer et pointer le suivant ».
- **Paramètres** : personnes suivies, médicaments (unité, seuil d'alerte), délai d'alerte général (7 jours).
