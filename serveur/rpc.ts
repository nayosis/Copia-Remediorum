/*
 * Fonctions métier appelables par le navigateur : POST /api/rpc/:nom { args }.
 * Ce sont les fonctions exportées des modules de src/data/ — tous, sauf ceux dont le nom commence par « _ »
 * (outils réservés au serveur). Le navigateur en reçoit des talons (même règle dans vite.config.ts).
 * Les lectures (serveur/modele.ts, LECTURES) sont ouvertes à tout compte connecté, rôle lecture compris ;
 * toute autre fonction est une écriture : rôle écriture, journalisée et diffusée.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { LECTURES } from "./modele";

const DOSSIER_DATA = join(import.meta.dir, "..", "src", "data");

/** Modules exposés : src/data/*.ts, sauf _*.ts. */
export const NOMS_MODULES_RPC = readdirSync(DOSSIER_DATA)
  .filter((f) => f.endsWith(".ts") && !f.startsWith("_"))
  .map((f) => f.slice(0, -3))
  .sort();

export type Droit = "lecture" | "ecriture";

type Fonction = (...args: unknown[]) => unknown;

export const FONCTIONS = new Map<string, { fn: Fonction; droit: Droit }>();
const LECTURE = new Set(LECTURES);
for (const module of NOMS_MODULES_RPC) {
  const contenu: Record<string, unknown> = await import(join(DOSSIER_DATA, `${module}.ts`));
  for (const [nom, valeur] of Object.entries(contenu)) {
    if (typeof valeur !== "function") continue;
    if (FONCTIONS.has(nom)) throw new Error(`Fonction RPC en double : ${nom} (${module})`);
    FONCTIONS.set(nom, { fn: valeur as Fonction, droit: LECTURE.has(nom) ? "lecture" : "ecriture" });
  }
}
for (const nom of LECTURE) if (!FONCTIONS.has(nom)) throw new Error(`Fonction de lecture inconnue : ${nom} (serveur/modele.ts)`);

/** Exécute une fonction RPC (droits déjà vérifiés par l'appelant). */
export async function executerRpc(nom: string, args: unknown[]) {
  const f = FONCTIONS.get(nom);
  if (!f) throw new Error(`Fonction inconnue : ${nom}`);
  // Certaines fonctions renvoient une requête Drizzle (« thenable ») : await l'exécute.
  const resultat = await f.fn(...args);
  return resultat === undefined ? null : resultat;
}
