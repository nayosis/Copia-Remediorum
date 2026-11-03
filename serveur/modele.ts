/*
 * Ce que le socle doit savoir du modèle de l'application : SEUL fichier du serveur à adapter quand on ajoute
 * une table ou une fonction métier (avec src/db/schema.ts, src/data/ et src/lib/modele.ts côté interface).
 *
 * Le reste de serveur/ (comptes, journal, traçabilité, sauvegardes, événements) est générique.
 * Exemple fourni : des notes et leurs pièces jointes (src/data/notes.ts), à remplacer.
 */
import type { Database } from "bun:sqlite";

/** Fonctions de src/data/ qui ne modifient rien. Toute autre fonction exposée est une écriture (sûr par défaut). */
export const LECTURES = ["listeNotes", "ficheNote", "accueil"];

/** Tables métier suivies : colonnes cree_par / modifie_par / modifie_le remplies par déclencheurs, instantanés du journal. */
export const TABLES_SUIVIES = ["note", "piece_jointe"];

/** Tables qu'une sauvegarde doit contenir pour être restaurée ici (vérifie qu'elle vient bien de cette application). */
export const TABLES_ATTENDUES = ["note", "piece_jointe", "journal", "__migrations"];

/** Compteurs affichés à la sauvegarde et gardés dans son manifeste (libellé → requête qui renvoie un nombre). */
export const COMPTEURS: Record<string, string> = {
  Notes: "select count(*) from note",
  "Pièces jointes": "select count(*) from piece_jointe",
};

/** Fichiers rattachés (data/fichiers/) : tout autre fichier est un orphelin, effacé au bout de 7 jours. */
export const REQUETE_FICHIERS_CITES = "select fichier from piece_jointe";

/**
 * Colonnes de lien vers une fiche parente : le journal d'une fiche montre aussi les écritures des lignes qui la
 * citent (l'historique d'une note inclut ses pièces jointes ajoutées ou retirées).
 */
export const LIENS_JOURNAL = ["note_id"];

/**
 * Complète l'instantané d'une fiche (journal, avant / après) de ce qui la décrit vraiment : ses liens, ses fichiers.
 * Une preuve doit se lire seule, sans la base d'origine.
 */
export function enrichir(base: Database, table: string, ligne: Record<string, unknown>) {
  if (table === "note") {
    ligne.pieces_jointes = base.query("SELECT id, nom, fichier, archive FROM piece_jointe WHERE note_id = ? ORDER BY cree_le").all(String(ligne.id));
  }
}
