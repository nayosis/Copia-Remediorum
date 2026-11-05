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
  (décidé) ; on choisit partagé ou propre à la création du stock (sans choix par défaut : il faut le dire), et on
  peut le changer ensuite en modifiant le stock (rôle écriture), tant qu'il n'existe pas déjà un stock actif pour ce
  médicament et cette personne (ou un stock partagé actif). Les traitements suivent la règle : changer un stock
  partagé en stock propre renvoie les traitements des autres personnes « sans stock » (signalés page Stocks).
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
  ce pointage + les ajouts saisis depuis (0.3). **On pointe le soir, après les prises du jour : la consommation reprend le lendemain** (décidé).
- **Date d'épuisement** = premier jour où le stock estimé ne couvre plus les prises du jour.
- **Alerte** : **7 jours** avant la date d'épuisement par défaut (paramètre général), **surchargeable par traitement**
  (médicament × personne). Un stock partagé alerte au plus grand délai de ses traitements.
- **Seul le stock déclenche l'alerte** (décidé) : pas de suivi de l'ordonnance (validité, renouvellements) en V1.
- **Deux mouvements : le pointage et l'ajout** (0.3 ; en V1 il n'y avait que le pointage). Boîte perdue, oubli de
  prise : on recompte (pointage). Pas de date de péremption.
- **Ajout (réapprovisionnement)** (0.3) : « +60 sachets le 5 nov. », avec une note facultative (« Pharmacie »). On ne
  recompte pas : le stock après l'ajout = **le restant prévu depuis le dernier pointage (comme si toutes les prises
  avaient été faites) + l'ajout**. L'ajout est **conservé tel quel** (table `ajout` : stock, date, quantité, note), pas
  converti en pointage : corriger un pointage plus ancien garde le calcul juste.
  - Quantité **en unités du médicament** (0.3 : pas de saisie en boîtes pour le moment), par quart comme le pointage.
  - **Pas de date dans le futur** ; un ajout daté d'avant le dernier pointage est accepté mais sans effet (déjà compté
    par le pointage), avec un avertissement à la saisie.
  - **Ordre le même jour : le dernier saisi l'emporte** (0.3) : un ajout saisi après le pointage du soir s'y ajoute ;
    un pointage saisi après l'ajout le remplace (il compte ce qui est là).
  - Calcul : **stock estimé = dernier pointage − consommation théorique + ajouts postérieurs à ce pointage** (ordre :
    date, puis heure de saisie). Un pointage remet tout à plat. Restant prévu épuisé : on repart de zéro (jamais
    négatif). **Stock jamais pointé : le premier ajout part de zéro** (0.3) : le stock devient connu.
  - Droits : le **rôle écriture ajoute** ; un **admin corrige ou supprime** un ajout (journal avant / après).
  - Saisie depuis la **fiche du stock** et depuis le bouton **« + » du téléphone** (choix « Pointer » /
    « Réapprovisionner »). La fenêtre montre le détail : compté le …, prises prévues depuis, ajout, total ce soir-là.
  - Fiche du stock : les ajouts figurent **dans la liste des pointages** (ligne « +60 » en vert) ; l'**écart** d'un
    pointage tient compte des ajouts intermédiaires (prévu = pointage précédent − prises + ajouts).
- Un pointage se corrige ou se supprime (admins) ; il reste au journal avec la fiche avant / après. Le rôle écriture
  pointe (un nouveau pointage remplace le précédent dans le calcul).
- **Création des stocks** : le premier traitement d'un médicament crée son **stock partagé** (le cas courant) ; un
  stock propre à une personne se crée depuis la page Stocks. Archiver un stock propre renvoie ses traitements au stock
  partagé.
- **Écart d'un pointage** (fiche du stock) : compté − prévu d'après le pointage précédent ; négatif : prise en trop,
  boîte perdue ; positif : oubli de prise, nouvelles boîtes. Il aide à repérer les oublis, sans rien bloquer.

## Fichiers

- **Pas de fichiers en V1** (ni ordonnance ni photo de boîte) : la gestion des fichiers du socle reste en place,
  inutilisée.

## Journal (preuve)

- Par défaut (socle) : chaque écriture journalisée, fiche entière avant / après, journal non modifiable.

## Exports

- **Une page « À renouveler »** (décidé), page d'accueil : les médicaments en alerte ou épuisés, **par personne** (un
  stock partagé figure chez chaque personne qui y puise, chacune ayant son ordonnance), avec la posologie, la date
  d'épuisement estimée et le stock estimé ce soir. Puis les stocks jamais pointés et les prochaines échéances.
- Elle s'**imprime** (bouton « Imprimer » : la liste seule, sans menu). Pas de PDF ni d'export en V1.
- **Carte « Ce soir, dans l'armoire »** (0.3), sur l'accueil **sous « À renouveler »** : **tous les stocks actifs**,
  avec le stock estimé ce soir (après les prises du jour) et « tient jusqu'au » (date d'épuisement, pastille de
  couleur du statut). Médicament sans posologie : le dernier comptage, précédé de « ≈ », et « si besoin ». Sur
  téléphone : liste compacte, comme la page Stocks.
- **Page « Stock à date »** (0.3), dans le menu à côté de Stocks, pour renouveler **juste ce qu'il faut** :
  - on choisit **« Tenir jusqu'au soir du »** une date (non retenue en quittant la page) ;
  - par stock actif : ce soir, **besoin** = prises prévues **du lendemain jusqu'au soir choisi inclus** (dates de fin
    des traitements comprises), **il manque** = besoin − ce soir, ou « Couvert (+N) » ; **pas de marge** ;
  - **en unités** (comprimés, sachets…) ; les boîtes (unités par boîte sur le médicament) viendront plus tard ;
  - un stock partagé : **une seule ligne, avec les prénoms** de ceux qui y puisent ;
  - médicament sans posologie : « si besoin », pas de calcul ;
  - elle s'**imprime** comme « À renouveler ».

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
- Chaque compte active les notifications **appareil par appareil** (menu du compte › « Notifications sur cet
  appareil » ; tout rôle, lecture compris). HTTPS obligatoire ; sur iPhone, l'application doit être ajoutée à l'écran
  d'accueil (iOS 16.4+).
- Envoi **une fois par jour, à partir de 9 h** (fuseau de l'installation), à tous les appareils abonnés. Plusieurs
  stocks dus le même jour : **une seule notification** qui les liste ; un seul : son nom et la date, et un toucher ouvre
  sa fiche.
- Technique (module du socle, `serveur/push.ts`) : Web Push sans service ni dépendance externe, clés VAPID créées au
  premier lancement (dans `comptes.db`), chiffrement aes128gcm (RFC 8291, vérifié sur l'exemple de la RFC). Ce qu'il
  faut envoyer est propre à l'application (`src/data/_notifications.ts`). À reporter dans le modèle Fundamentum.

## Hors V1

- Suivi des prises une par une (ce n'est pas le but).
- Ordonnances (validité, renouvellements restants).
- Dates de péremption. Quantités en boîtes (unités par boîte) : plus tard (0.3).
- Consommation estimée par semaine pour les doses variables.

## Plan de la V1

1. Socle (fait) : dépôt créé depuis le modèle Fundamentum, renommé, couleur et logo.
2. Référentiel (fait) : personnes, médicaments (unité, seuil d'alerte), traitements et posologies, paramètres (délai
   d'alerte général : 7 jours) ; le module d'exemple « notes » est retiré.
3. Stocks et pointages (fait) : stocks partagés ou propres, pointage sur téléphone (saisie rapide), calcul du stock estimé
   et de la date d'épuisement (fonctions pures, très testées : rythmes, quarts, dates de fin, stock partagé).
4. « À renouveler » (fait) : la page (accueil de l'application), par personne, et la fiche de chaque stock (pointages,
   consommation, historique).
5. Notifications (fait) : module Web Push (abonnement par compte, tâche quotidienne du serveur, rappel hebdomadaire).
6. Publication : version 1.0, image ghcr.io, déploiement personnel.

## Plan de la 0.3

1. Réapprovisionnement : table `ajout` (migration), calcul du stock (ajouts après le dernier pointage, ordre de saisie
   le même jour), écart des pointages, fonctions `ajouter` / `majAjout` / `supprimerAjout`, fenêtre sur la fiche et
   dans le « + » du téléphone. Tests du calcul (fonctions pures) et des droits.
2. Carte « Ce soir » sur l'accueil.
3. Page « Stock à date » (calcul du besoin jusqu'à une date : fonction pure testée), imprimable.
