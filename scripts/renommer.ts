/*
 * Donne son nom à une nouvelle application créée depuis le modèle Fundamentum (« Use this template ») :
 *
 *   bun scripts/renommer.ts "Custos Domus" nayosis/custos-domus "Ce que fait l'application, en une phrase."
 *
 * Remplace partout « Fundamentum » (nom affiché), « fundamentum » (identifiant : image Docker, fichiers de sauvegarde,
 * cookie…) et « nayosis/fundamentum » (dépôt GitHub : vérification des mises à jour, liens). Le préfixe des variables
 * d'environnement (APP_) et l'en-tête X-App restent les mêmes d'une application à l'autre.
 * Les lignes qui contiennent le mot « modèle » ne sont pas touchées : elles désignent le dépôt modèle lui-même
 * (CLAUDE.md, skills), d'où l'on reportera les améliorations du socle.
 * À lancer une seule fois, sur un dépôt propre (git status vide) : le résultat se relit avec git diff.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const [nom, depot, description] = process.argv.slice(2);
if (!nom || !depot || !/^[\w.-]+\/[\w.-]+$/.test(depot)) {
  console.error('Usage : bun scripts/renommer.ts "Nom affiché" compte/depot ["Description en une phrase"]');
  process.exit(1);
}
const identifiant = depot.split("/")[1].toLowerCase();

const RACINE = join(import.meta.dir, "..");
const IGNORES = new Set(["node_modules", ".git", "dist", "data", "bun.lock", "LICENSE", "renommer.ts"]);
const EXTENSIONS = new Set([".ts", ".tsx", ".json", ".webmanifest", ".html", ".md", ".yml", ".yaml", ".conf", ".css", ".svg", ""]);

const remplacements: [RegExp, string][] = [
  [/nayosis\/fundamentum/g, depot],
  [/Fundamentum/g, nom],
  [/fundamentum/g, identifiant],
];
if (description) remplacements.unshift([/Socle d'application familiale auto-hébergée/g, description]);

function parcourir(dossier: string): string[] {
  return readdirSync(dossier).flatMap((f) => {
    if (IGNORES.has(f)) return [];
    const chemin = join(dossier, f);
    if (statSync(chemin).isDirectory()) return parcourir(chemin);
    return EXTENSIONS.has(extname(f)) || f.startsWith(".env") || f === "Dockerfile" ? [chemin] : [];
  });
}

let n = 0;
for (const fichier of parcourir(RACINE)) {
  const avant = readFileSync(fichier, "utf8");
  const apres = avant
    .split("\n")
    .map((ligne) => (ligne.includes("modèle") ? ligne : remplacements.reduce((t, [motif, par]) => t.replace(motif, par), ligne)))
    .join("\n");
  if (apres !== avant) {
    writeFileSync(fichier, apres);
    console.log(`  ${fichier.slice(RACINE.length + 1)}`);
    n++;
  }
}
console.log(`${n} fichier(s) modifié(s) : « ${nom} », dépôt ${depot}, identifiant ${identifiant}.`);
console.log("Ensuite : couleur et logo (src/theme.ts, src/components/Logo.tsx, public/icone.svg puis bun scripts/icones.ts), CHANGELOG.md, docs/conception.md.");
