/*
 * Ce que le socle doit savoir du modèle de l'application : SEUL fichier du serveur à adapter quand on ajoute
 * une table ou une fonction métier (avec src/db/schema.ts, src/data/ et src/lib/modele.ts côté interface).
 * Le reste de serveur/ (comptes, journal, traçabilité, sauvegardes, événements) est le socle commun (modèle Fundamentum).
 */
import type { Database } from "bun:sqlite";

/** Fonctions de src/data/ qui ne modifient rien. Toute autre fonction exposée est une écriture (sûr par défaut). */
export const LECTURES = ["listePersonnes", "listeMedicaments", "lireParametres", "listeTraitements"];

/** Tables métier suivies : colonnes cree_par / modifie_par / modifie_le remplies par déclencheurs, instantanés du journal. */
export const TABLES_SUIVIES = ["personne", "medicament", "traitement"];

/** Tables qu'une sauvegarde doit contenir pour être restaurée ici (vérifie qu'elle vient bien de cette application). */
export const TABLES_ATTENDUES = ["personne", "medicament", "traitement", "journal", "__migrations"];

/** Compteurs affichés à la sauvegarde et gardés dans son manifeste (libellé → requête qui renvoie un nombre). */
export const COMPTEURS: Record<string, string> = {
  Personnes: "select count(*) from personne",
  Médicaments: "select count(*) from medicament",
  Traitements: "select count(*) from traitement",
};

/** Fichiers rattachés (data/fichiers/) : aucun en V1 (pas de pièce jointe) ; tout fichier envoyé est un orphelin. */
export const REQUETE_FICHIERS_CITES = "select null where 0";

/** Colonnes de lien vers une fiche parente : l'historique d'une fiche montre aussi les lignes qui la citent. */
export const LIENS_JOURNAL: string[] = [];

/** Complète l'instantané d'une fiche (journal, avant / après) : une preuve doit se lire seule, sans la base. */
export function enrichir(base: Database, table: string, ligne: Record<string, unknown>) {
  if (table === "traitement") {
    ligne.personne = base.query<{ prenom: string }, [string]>("SELECT prenom FROM personne WHERE id = ?").get(String(ligne.personne_id))?.prenom ?? null;
    ligne.medicament = base.query<{ nom: string }, [string]>("SELECT nom FROM medicament WHERE id = ?").get(String(ligne.medicament_id))?.nom ?? null;
  }
}
