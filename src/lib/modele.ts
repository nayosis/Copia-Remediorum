/*
 * Ce que l'interface du socle (journal, historique) doit savoir du modèle de l'application.
 * Pendant de serveur/modele.ts.
 */
import { posologieLisible, type Posologie } from "./posologie";
import { quantiteLisible } from "./quantites";
import { dateLisible } from "./dates";

/** Libellés lisibles des fonctions d'écriture (journal) ; les autres sont affichées telles quelles. */
export const LIBELLES_FONCTIONS: Record<string, string> = {
  creerPersonne: "Nouvelle personne",
  majPersonne: "Personne modifiée",
  archiverPersonne: "Personne archivée / désarchivée",
  creerMedicament: "Nouveau médicament",
  majMedicament: "Médicament modifié",
  archiverMedicament: "Médicament archivé / désarchivé",
  majParametres: "Paramètres modifiés",
  creerTraitement: "Nouveau traitement",
  majTraitement: "Traitement modifié",
  supprimerTraitement: "Traitement supprimé",
  creerStock: "Nouveau stock",
  majStock: "Stock modifié",
  archiverStock: "Stock archivé / désarchivé",
  pointer: "Pointage",
  majPointage: "Pointage corrigé",
  supprimerPointage: "Pointage supprimé",
  ajouter: "Réapprovisionnement",
  majAjout: "Réapprovisionnement corrigé",
  supprimerAjout: "Réapprovisionnement supprimé",
};

/** Libellés des champs dans les écarts avant / après du journal. */
export const LIBELLES_CHAMPS: Record<string, string> = {
  prenom: "Prénom",
  ordre: "Ordre",
  archivee: "Archivée",
  archive: "Archivé",
  nom: "Nom",
  unite: "Unité",
  seuil_alerte: "Seuil d'alerte",
  note: "Note",
  personne: "Personne",
  medicament: "Médicament",
  posologie: "Posologie",
  debut: "Début",
  fin: "Fin",
  delai_alerte: "Délai d'alerte (jours)",
  stock: "Stock",
  date: "Date",
  quantite: "Quantité",
};

/** Colonnes techniques, jamais montrées dans un écart (les colonnes de liens `*_id` sont ajoutées d'office). */
export const CHAMPS_IGNORES = new Set(["table", "id", "cree_le", "cree_par", "modifie_par", "modifie_le"]);

/** Champs booléens (affichés oui / non). */
export const CHAMPS_BOOLEENS = new Set(["archive", "archivee"]);

/** Champs en centimes (affichés en euros). */
export const CHAMPS_MONTANTS = new Set<string>([]);

/** Listes de fichiers rattachés (affichées par leurs noms, sans les retirés). */
export const CHAMPS_FICHIERS = new Set<string>([]);

/** Champs propres à l'application, affichés autrement que tels quels (null : affichage par défaut). */
export function lisibleMetier(cle: string, v: unknown): string | null {
  if ((cle === "seuil_alerte" || cle === "quantite") && typeof v === "number") return quantiteLisible(v);
  if ((cle === "date" || cle === "debut" || cle === "fin") && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return dateLisible(v);
  if (cle === "posologie") {
    try {
      return posologieLisible(typeof v === "string" ? (JSON.parse(v) as Posologie) : null);
    } catch {
      return String(v);
    }
  }
  return null;
}
