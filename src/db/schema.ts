import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/*
 * Schéma de la base métier (data/donnees.db). Les comptes et les sessions sont à part (data/comptes.db, serveur/comptes.ts).
 * Dates : chaînes ISO « AAAA-MM-JJ ». Montants : entiers en centimes. Identifiants : UUID.
 * Après modification : bun run db:generate (nouvelle migration dans drizzle/), puis serveur/modele.ts.
 */

const id = () => text("id").primaryKey();
const creeLe = () => text("cree_le").notNull().default(sql`(datetime('now'))`);

/**
 * Qui a créé / modifié la ligne, et quand (ISO, à la milliseconde). Remplies par le serveur
 * (déclencheurs SQLite, cf. serveur/tracabilite.ts) ; `modifieLe` sert aussi de version (conflits).
 * À mettre sur toute table métier, déclarée ensuite dans TABLES_SUIVIES (serveur/modele.ts).
 */
const tracabilite = () => ({
  creePar: text("cree_par"),
  modifiePar: text("modifie_par"),
  modifieLe: text("modifie_le"),
});

// --- Socle

/** Réglages de l'application, avec les données (donc sauvegardés) : clé → valeur (texte ou JSON). */
export const parametre = sqliteTable("parametre", {
  cle: text("cle").primaryKey(),
  valeur: text("valeur").notNull(),
});

/**
 * Journal des modifications : une ligne par action d'écriture (fonction appelée, par qui, sur quoi).
 * `avant` / `apres` : la fiche entière (JSON) avant et après l'écriture, pour prouver ce qui a changé.
 */
export const journal = sqliteTable(
  "journal",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    quand: text("quand").notNull(),
    utilisateur: text("utilisateur").notNull(),
    fonction: text("fonction").notNull(),
    cible: text("cible"),
    resume: text("resume"),
    avant: text("avant"),
    apres: text("apres"),
  },
  (t) => [index("journal_quand_idx").on(t.quand), index("journal_utilisateur_idx").on(t.utilisateur), index("journal_cible_idx").on(t.cible)],
);

// --- Exemple (à remplacer par le modèle de l'application)

/** Une note : titre, texte, pièces jointes. Archivée plutôt que supprimée (elle reste dans le journal). */
export const note = sqliteTable(
  "note",
  {
    id: id(),
    titre: text("titre").notNull(),
    texte: text("texte"),
    archivee: integer("archivee", { mode: "boolean" }).notNull().default(false),
    creeLe: creeLe(),
    ...tracabilite(),
  },
  (t) => [index("note_archivee_idx").on(t.archivee)],
);

/**
 * Un fichier (photo JPEG, PDF) rattaché à une note.
 * Jamais effacé : une pièce jointe retirée est archivée et reste visible depuis le journal (preuve).
 */
export const pieceJointe = sqliteTable(
  "piece_jointe",
  {
    id: id(),
    noteId: text("note_id")
      .notNull()
      .references(() => note.id, { onDelete: "restrict" }),
    /** Nom affiché (celui du fichier envoyé). */
    nom: text("nom").notNull(),
    /** Nom sur le disque, choisi par le serveur (UUID + extension). */
    fichier: text("fichier").notNull(),
    mime: text("mime").notNull(),
    taille: integer("taille").notNull(),
    archive: integer("archive", { mode: "boolean" }).notNull().default(false),
    creeLe: creeLe(),
    ...tracabilite(),
  },
  (t) => [index("piece_jointe_note_idx").on(t.noteId)],
);

export type Note = typeof note.$inferSelect;
export type PieceJointe = typeof pieceJointe.$inferSelect;
