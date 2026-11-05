/*
 * Calcul du stock : à partir du dernier pointage et des posologies, le stock estimé, la date d'épuisement et l'alerte.
 * Fonctions pures (aucune base), partagées par le serveur (listes, notifications) et testées en détail.
 *
 * Règles (docs/conception.md) :
 *  - on pointe le soir, après les prises du jour : la consommation reprend le lendemain du pointage ;
 *  - stock estimé (ce soir) = pointage − prises théoriques des jours suivants jusqu'à aujourd'hui inclus ;
 *  - un ajout (réapprovisionnement) repart du restant prévu ce soir-là (jamais négatif) + la quantité ajoutée ;
 *  - date d'épuisement = premier jour où le stock restant ne couvre plus les prises du jour ;
 *  - alerte = date d'épuisement − délai (le plus grand des traitements en cours ; sinon le délai général),
 *    ou stock estimé sous le seuil du médicament.
 */
import { ajouterJours } from "./dates";
import { priseDuJour, type Posologie } from "./posologie";

export type TraitementDuStock = { posologie: Posologie | null; debut: string; fin: string | null; delaiAlerte: number | null };
export type Pointage = { date: string; quantite: number };
/** Un réapprovisionnement : le soir de `date`, `quantite` (quarts) s'ajoute au restant prévu. */
export type Ajout = { date: string; quantite: number };

export type Statut =
  /** Jamais pointé : stock inconnu. */
  | "inconnu"
  /** Rien à prévoir : aucune consommation calculée et pas de seuil. */
  | "sans_suivi"
  | "ok"
  /** À renouveler : dans le délai d'alerte, ou sous le seuil. */
  | "alerte"
  /** Les prises d'aujourd'hui (ou d'avant) ne sont plus couvertes. */
  | "epuise";

export type EtatStock = {
  statut: Statut;
  pointage: Pointage | null;
  /** Point de départ du calcul : le dernier pointage, recalé par les ajouts qui le suivent. */
  depart: Pointage | null;
  /** Stock estimé ce soir, en quarts (jamais négatif : 0 une fois épuisé). */
  estime: number | null;
  /** Premier jour non couvert ; null si jamais (consommation nulle, traitements finis). */
  epuisement: string | null;
  /** Jour à partir duquel il faut renouveler (épuisement − délai). */
  alerteLe: string | null;
  /** Délai d'alerte retenu, en jours. */
  delai: number;
  /** Stock estimé sous le seuil d'alerte du médicament. */
  sousSeuil: boolean;
};

/** Au-delà, on ne cherche plus la date d'épuisement (3 ans). */
const HORIZON_JOURS = 3 * 366;

/** Prises théoriques d'un jour, tous traitements du stock confondus (quarts). */
export const prisesDuJour = (traitements: TraitementDuStock[], jour: string) =>
  traitements.reduce((t, x) => t + priseDuJour(x.posologie, { debut: x.debut, fin: x.fin }, jour), 0);

/** Stock estimé le soir de `jour` à partir d'un pointage (peut être négatif : prises non couvertes). */
export function estimerAu(pointage: Pointage, traitements: TraitementDuStock[], jour: string) {
  let stock = pointage.quantite;
  for (let d = ajouterJours(pointage.date, 1); d <= jour; d = ajouterJours(d, 1)) stock -= prisesDuJour(traitements, d);
  return stock;
}

/**
 * Point de départ du calcul : le pointage, puis chaque ajout qui le suit (triés par date) le remplace par
 * « restant prévu ce soir-là (jamais négatif) + ajout ». Sans pointage, le premier ajout part de zéro.
 */
export function recaler(pointage: Pointage | null, ajouts: Ajout[], traitements: TraitementDuStock[]): Pointage | null {
  let depart = pointage;
  for (const a of [...ajouts].sort((x, y) => x.date.localeCompare(y.date))) {
    const restant = depart ? Math.max(0, estimerAu(depart, traitements, a.date)) : 0;
    depart = { date: a.date, quantite: restant + a.quantite };
  }
  return depart;
}

/** Premier jour, après le pointage, où le stock restant ne couvre plus les prises du jour (null : jamais). */
export function dateEpuisement(pointage: Pointage, traitements: TraitementDuStock[]) {
  const consommant = traitements.filter((t) => t.posologie);
  if (!consommant.length) return null;
  // Dernier jour de consommation possible : la plus tardive des dates de fin (sans fin : l'horizon).
  const limite = consommant.some((t) => !t.fin) ? ajouterJours(pointage.date, HORIZON_JOURS) : consommant.map((t) => t.fin!).sort().at(-1)!;
  let stock = pointage.quantite;
  for (let d = ajouterJours(pointage.date, 1); d <= limite; d = ajouterJours(d, 1)) {
    const besoin = prisesDuJour(traitements, d);
    if (besoin > stock) return d;
    stock -= besoin;
  }
  return null;
}

/** Délai d'alerte d'un stock : le plus grand de ses traitements en cours (sans délai propre : le délai général). */
export function delaiDuStock(traitements: TraitementDuStock[], aujourdhui: string, delaiGeneral: number) {
  const enCours = traitements.filter((t) => !t.fin || t.fin >= aujourdhui);
  if (!enCours.length) return delaiGeneral;
  return Math.max(...enCours.map((t) => t.delaiAlerte ?? delaiGeneral));
}

export function calculerStock(e: {
  pointage: Pointage | null;
  /** Ajouts postérieurs au pointage (ou tous, s'il n'y en a pas). */
  ajouts?: Ajout[];
  traitements: TraitementDuStock[];
  aujourdhui: string;
  delaiGeneral: number;
  /** Seuil du médicament, en quarts (null : aucun). */
  seuil: number | null;
}): EtatStock {
  const delai = delaiDuStock(e.traitements, e.aujourdhui, e.delaiGeneral);
  const depart = recaler(e.pointage, e.ajouts ?? [], e.traitements);
  if (!depart) return { statut: "inconnu", pointage: null, depart: null, estime: null, epuisement: null, alerteLe: null, delai, sousSeuil: false };
  const estime = Math.max(0, estimerAu(depart, e.traitements, e.aujourdhui));
  const epuisement = dateEpuisement(depart, e.traitements);
  const alerteLe = epuisement ? ajouterJours(epuisement, -delai) : null;
  const sousSeuil = e.seuil !== null && estime < e.seuil;
  const consomme = e.traitements.some((t) => t.posologie && (!t.fin || t.fin >= e.aujourdhui));
  const statut: Statut =
    epuisement && epuisement <= e.aujourdhui
      ? "epuise"
      : (alerteLe && e.aujourdhui >= alerteLe) || sousSeuil
        ? "alerte"
        : !consomme && e.seuil === null
          ? "sans_suivi"
          : "ok";
  return { statut, pointage: e.pointage, depart, estime, epuisement, alerteLe, delai, sousSeuil };
}

/** Ordre d'urgence pour les listes : épuisé, alerte, inconnu, ok, sans suivi ; puis date d'épuisement. */
export function ordreUrgence(a: EtatStock, b: EtatStock) {
  const rang: Record<Statut, number> = { epuise: 0, alerte: 1, inconnu: 2, ok: 3, sans_suivi: 4 };
  return rang[a.statut] - rang[b.statut] || (a.epuisement ?? "9999").localeCompare(b.epuisement ?? "9999");
}
