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

// --- Référentiel : qui prend quoi, et comment

/** Une personne suivie (« Jeanne », « Robert »). Archivée plutôt que supprimée (elle reste dans le journal). */
export const personne = sqliteTable("personne", {
  id: id(),
  prenom: text("prenom").notNull(),
  ordre: integer("ordre").notNull().default(0),
  archivee: integer("archivee", { mode: "boolean" }).notNull().default(false),
  creeLe: creeLe(),
  ...tracabilite(),
});

/** Un médicament (« Kardégic 75 mg »), compté dans son unité (comprimé, gélule, sachet…). */
export const medicament = sqliteTable("medicament", {
  id: id(),
  nom: text("nom").notNull(),
  unite: text("unite").notNull().default("comprimé"),
  /** Seuil d'alerte en quarts d'unité (facultatif) : alerte quand le stock estimé passe dessous. */
  seuilAlerte: integer("seuil_alerte"),
  note: text("note"),
  archive: integer("archive", { mode: "boolean" }).notNull().default(false),
  creeLe: creeLe(),
  ...tracabilite(),
});

/**
 * Un médicament pris par une personne. `posologie` : JSON (src/lib/posologie.ts) ; vide = sans posologie (si besoin).
 * `delaiAlerte` : jours avant l'épuisement pour alerter ; vide = délai général (Paramètres).
 */
export const traitement = sqliteTable(
  "traitement",
  {
    id: id(),
    personneId: text("personne_id")
      .notNull()
      .references(() => personne.id, { onDelete: "restrict" }),
    medicamentId: text("medicament_id")
      .notNull()
      .references(() => medicament.id, { onDelete: "restrict" }),
    posologie: text("posologie"),
    debut: text("debut").notNull(),
    fin: text("fin"),
    delaiAlerte: integer("delai_alerte"),
    note: text("note"),
    creeLe: creeLe(),
    ...tracabilite(),
  },
  (t) => [index("traitement_personne_idx").on(t.personneId), index("traitement_medicament_idx").on(t.medicamentId)],
);

export type Personne = typeof personne.$inferSelect;
export type Medicament = typeof medicament.$inferSelect;
export type Traitement = typeof traitement.$inferSelect;
