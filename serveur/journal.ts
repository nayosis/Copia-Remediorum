/**
 * Journal des modifications : qui a appelé quelle fonction d'écriture, sur quelle fiche, quand,
 * et la fiche entière avant et après (la preuve de ce qui a changé).
 */
import { baseCourante } from "./base";
import { enrichir, LIENS_JOURNAL, TABLES_SUIVIES } from "./modele";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fiche visée par les arguments : le premier identifiant (modification, suppression). */
export const cibleDesArguments = (args: unknown[]) => {
  const id = args.find((a) => typeof a === "string" && UUID.test(a));
  return typeof id === "string" ? id : null;
};

/** Fiche concernée : celle des arguments, sinon celle renvoyée (création). */
function cibleDe(args: unknown[], resultat: unknown) {
  return cibleDesArguments(args) ?? (typeof resultat === "string" && UUID.test(resultat) ? resultat : null);
}

/** Résumé lisible des arguments (tronqué) : utile pour savoir ce qui a été demandé. */
function resumeDe(args: unknown[]) {
  const texte = JSON.stringify(args.filter((a) => !(typeof a === "string" && UUID.test(a))));
  return texte.length > 400 ? `${texte.slice(0, 399)}…` : texte;
}

type Ligne = Record<string, unknown>;

/**
 * La fiche telle qu'elle est en base, quelle que soit sa table (null si elle n'existe pas ou plus),
 * complétée de ses liens (serveur/modele.ts, `enrichir`).
 */
export function instantane(id: string): (Ligne & { table: string }) | null {
  const base = baseCourante();
  for (const table of TABLES_SUIVIES) {
    const ligne = base.query<Ligne, [string]>(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    if (!ligne) continue;
    enrichir(base, table, ligne);
    return { table, ...ligne };
  }
  return null;
}

export function journaliser(utilisateur: string, fonction: string, args: unknown[], resultat: unknown, avant: unknown = null) {
  try {
    const cible = cibleDe(args, resultat);
    const apres = cible ? instantane(cible) : null;
    baseCourante()
      .query("INSERT INTO journal (quand, utilisateur, fonction, cible, resume, avant, apres) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(
        new Date().toISOString(),
        utilisateur,
        fonction,
        cible,
        resumeDe(args),
        avant ? JSON.stringify(avant) : null,
        apres ? JSON.stringify(apres) : null,
      );
  } catch (e) {
    // Le journal ne doit jamais faire échouer l'écriture elle-même.
    console.error("Journal :", e);
  }
}

export type LigneJournal = {
  id: number;
  quand: string;
  utilisateur: string;
  fonction: string;
  cible: string | null;
  resume: string | null;
  avant: string | null;
  apres: string | null;
};

/** 200 lignes au plus, des plus récentes aux plus anciennes ; `avant` : id pour la page suivante ; `cible` : une fiche. */
export function lireJournal(f: { utilisateur?: string; depuis?: string; avant?: number; cible?: string }) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (f.utilisateur) {
    conditions.push("utilisateur = ?");
    params.push(f.utilisateur);
  }
  if (f.depuis) {
    conditions.push("quand >= ?");
    params.push(f.depuis);
  }
  if (f.avant) {
    conditions.push("id < ?");
    params.push(f.avant);
  }
  if (f.cible) {
    // La fiche, et les lignes qui la citent (serveur/modele.ts, LIENS_JOURNAL) : ses pièces jointes, par exemple.
    const liens = LIENS_JOURNAL.flatMap((c) => [`json_extract(apres, '$.${c}') = ?`, `json_extract(avant, '$.${c}') = ?`]);
    conditions.push(`(${["cible = ?", ...liens].join(" OR ")})`);
    params.push(f.cible, ...liens.map(() => f.cible!));
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return baseCourante()
    .query<LigneJournal, (string | number)[]>(`SELECT id, quand, utilisateur, fonction, cible, resume, avant, apres FROM journal ${where} ORDER BY id DESC LIMIT 200`)
    .all(...params);
}
