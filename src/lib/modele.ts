/*
 * Ce que l'interface du socle (journal, historique) doit savoir du modèle de l'application :
 * SEUL fichier de l'interface du socle à adapter quand on ajoute des fonctions ou des champs.
 * Pendant de serveur/modele.ts. Exemple fourni : les notes.
 */

/** Libellés lisibles des fonctions d'écriture (journal) ; les autres sont affichées telles quelles. */
export const LIBELLES_FONCTIONS: Record<string, string> = {
  creerNote: "Nouvelle note",
  majNote: "Note modifiée",
  archiverNote: "Note archivée / désarchivée",
  ajouterPieces: "Pièce jointe ajoutée",
  retirerPiece: "Pièce jointe retirée",
};

/** Libellés des champs dans les écarts avant / après du journal. */
export const LIBELLES_CHAMPS: Record<string, string> = {
  titre: "Titre",
  texte: "Texte",
  archivee: "Archivée",
  archive: "Retirée",
  pieces_jointes: "Pièces jointes",
  nom: "Nom",
  fichier: "Fichier",
  mime: "Type",
  taille: "Taille",
};

/** Colonnes techniques, jamais montrées dans un écart (les colonnes de liens `*_id` sont ajoutées d'office). */
export const CHAMPS_IGNORES = new Set(["table", "id", "cree_le", "cree_par", "modifie_par", "modifie_le"]);

/** Champs booléens (affichés oui / non). */
export const CHAMPS_BOOLEENS = new Set(["archive", "archivee"]);

/** Champs en centimes (affichés en euros). */
export const CHAMPS_MONTANTS = new Set<string>([]);

/** Listes de fichiers rattachés (affichées par leurs noms, sans les retirés). */
export const CHAMPS_FICHIERS = new Set(["pieces_jointes"]);
