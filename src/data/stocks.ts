/*
 * Stocks et pointages. Un traitement puise dans le stock propre à sa personne s'il existe, sinon dans le stock partagé
 * de son médicament (docs/conception.md). Le calcul (stock estimé, épuisement, alerte) est dans src/lib/stock.ts.
 */
import { newId, query } from "../db/client";
import { ErreurMetier } from "../../serveur/erreurs";
import { adminCourant } from "../../serveur/tracabilite";
import { ajouterJours, aujourdhui } from "../lib/dates";
import type { Posologie } from "../lib/posologie";
import { calculerStock, estimerAu, ordreUrgence, recaler, type Ajout, type EtatStock, type TraitementDuStock } from "../lib/stock";
import { DATE, delaiAlerteGeneral, exiger } from "./_commun";
import { verifierVersion, versionDe } from "./_version";

export type TraitementLie = TraitementDuStock & { id: string; personneId: string; prenom: string };

export type StockCalcule = {
  id: string;
  medicamentId: string;
  medicament: string;
  unite: string;
  seuil: number | null;
  /** null : stock partagé. */
  personneId: string | null;
  prenom: string | null;
  archive: boolean;
  modifieLe: string | null;
  /** Traitements qui y puisent (en cours ou non : le calcul tient compte des dates). */
  traitements: TraitementLie[];
  etat: EtatStock;
};

type LigneStock = Omit<StockCalcule, "traitements" | "etat">;

/** Un mouvement daté et horodaté (heure de saisie) : départage un pointage et un ajout du même jour. */
type Horodate = { date: string; creeLe: string };

/**
 * Un ajout compte après un pointage s'il est daté après, ou du même jour et saisi après (docs/conception.md :
 * le dernier saisi l'emporte). Saisis dans la même seconde : l'ajout passe après.
 */
const ajoutApres = (a: Horodate, p: Horodate | null) => !p || a.date > p.date || (a.date === p.date && a.creeLe >= p.creeLe);

let derniereSaisie = 0;

/**
 * Heure de saisie des pointages et ajouts, à la milliseconde et strictement croissante (un seul serveur) : elle
 * départage deux mouvements du même jour. Même format UTC que la valeur par défaut de cree_le (à la seconde), avec
 * laquelle elle se compare comme une chaîne.
 */
function saisiLe() {
  derniereSaisie = Math.max(Date.now(), derniereSaisie + 1);
  return new Date(derniereSaisie).toISOString().replace("T", " ").slice(0, 23);
}

type LigneAjout =Ajout & Horodate & { id: string; note: string | null; creePar: string | null; modifieLe: string | null };

/** Les ajouts, par stock, dans l'ordre (date, saisie). */
async function ajoutsParStock(stockId?: string) {
  const lignes = await query(
    `select id, stock_id, date, quantite, note, cree_par, cree_le, modifie_le from ajout ${stockId ? "where stock_id = ?" : ""} order by date, cree_le, rowid`,
    stockId ? [stockId] : [],
  );
  const m = new Map<string, LigneAjout[]>();
  for (const [id, s, date, quantite, note, creePar, creeLe, modifieLe] of lignes)
    m.set(s as string, [
      ...(m.get(s as string) ?? []),
      {
        id: id as string,
        date: date as string,
        quantite: Number(quantite),
        note: note as string | null,
        creePar: creePar as string | null,
        creeLe: creeLe as string,
        modifieLe: modifieLe as string | null,
      },
    ]);
  return m;
}

/** Tous les stocks, avec leurs traitements, leur dernier pointage et leur état, du plus urgent au moins urgent. */
export async function listeStocks(f: { archives?: boolean; jour?: string } = {}): Promise<StockCalcule[]> {
  const jour = f.jour ?? aujourdhui();
  const delaiGeneral = await delaiAlerteGeneral();
  const stocks: LigneStock[] = (
    await query(
      `select s.id, s.medicament_id, m.nom, m.unite, m.seuil_alerte, s.personne_id, p.prenom, s.archive, s.modifie_le
       from stock s join medicament m on m.id = s.medicament_id left join personne p on p.id = s.personne_id`,
    )
  ).map(([id, medicamentId, medicament, unite, seuil, personneId, prenom, archive, modifieLe]) => ({
    id: id as string,
    medicamentId: medicamentId as string,
    medicament: medicament as string,
    unite: unite as string,
    seuil: seuil as number | null,
    personneId: personneId as string | null,
    prenom: prenom as string | null,
    archive: !!archive,
    modifieLe: modifieLe as string | null,
  }));
  const derniers = new Map(
    (
      await query(
        `select stock_id, date, quantite, cree_le from (
           select stock_id, date, quantite, cree_le, row_number() over (partition by stock_id order by date desc, cree_le desc, rowid desc) rang from pointage)
         where rang = 1`,
      )
    ).map(([s, date, quantite, creeLe]) => [s as string, { date: date as string, quantite: Number(quantite), creeLe: creeLe as string }]),
  );
  const parStock = await traitementsParStock(stocks);
  const ajouts = await ajoutsParStock();
  return stocks
    .filter((s) => f.archives || !s.archive)
    .map((s) => {
      const traitements = parStock.get(s.id) ?? [];
      const dernier = derniers.get(s.id) ?? null;
      const suivants = (ajouts.get(s.id) ?? []).filter((a) => a.date <= jour && ajoutApres(a, dernier));
      const pointage = dernier && { date: dernier.date, quantite: dernier.quantite };
      return { ...s, traitements, etat: calculerStock({ pointage, ajouts: suivants, traitements, aujourdhui: jour, delaiGeneral, seuil: s.seuil }) };
    })
    .sort((a, b) => ordreUrgence(a.etat, b.etat) || a.medicament.localeCompare(b.medicament, "fr") || (a.prenom ?? "").localeCompare(b.prenom ?? "", "fr"));
}

/** Tous les traitements, avec le stock où ils puisent (null : aucun stock pour ce médicament). */
async function traitementsAvecStock(stocks: LigneStock[]) {
  const actifs = stocks.filter((s) => !s.archive);
  const lignes = await query(
    `select t.id, t.personne_id, p.prenom, t.medicament_id, t.posologie, t.debut, t.fin, t.delai_alerte from traitement t join personne p on p.id = t.personne_id`,
  );
  return lignes.map(([id, personneId, prenom, medicamentId, posologie, debut, fin, delaiAlerte]) => {
    const propre = actifs.find((s) => s.medicamentId === medicamentId && s.personneId === personneId);
    const partage = actifs.find((s) => s.medicamentId === medicamentId && s.personneId === null);
    return {
      stockId: (propre ?? partage)?.id ?? null,
      medicamentId: medicamentId as string,
      traitement: {
        id: id as string,
        personneId: personneId as string,
        prenom: prenom as string,
        posologie: posologie ? (JSON.parse(posologie as string) as Posologie) : null,
        debut: debut as string,
        fin: fin as string | null,
        delaiAlerte: delaiAlerte as number | null,
      } satisfies TraitementLie,
    };
  });
}

async function traitementsParStock(stocks: LigneStock[]) {
  const m = new Map<string, TraitementLie[]>();
  for (const t of await traitementsAvecStock(stocks)) if (t.stockId) m.set(t.stockId, [...(m.get(t.stockId) ?? []), t.traitement]);
  return m;
}

export type Mouvement = {
  type: "pointage" | "ajout";
  id: string;
  date: string;
  quantite: number;
  note: string | null;
  creePar: string | null;
  modifieLe: string | null;
  /** Pointage : ce que le calcul prévoyait ce soir-là (pointage précédent, prises, ajouts entre les deux). */
  attendu: number | null;
};

/**
 * Une fiche de stock : son état, ses traitements, et ses mouvements du plus récent au plus ancien : pointages (avec
 * l'écart à l'estimation : oubli, perte…) et ajouts.
 */
export async function ficheStock(id: string) {
  const s = (await listeStocks({ archives: true })).find((x) => x.id === id);
  if (!s) throw new ErreurMetier("Stock introuvable.", 404);
  const lignes = await query("select id, date, quantite, note, cree_par, cree_le, modifie_le from pointage where stock_id = ? order by date, cree_le, rowid", [id]);
  const ajouts = (await ajoutsParStock(id)).get(id) ?? [];
  const pointages = lignes.map(([pid, date, quantite, note, creePar, creeLe, modifieLe]) => ({
    id: pid as string,
    date: date as string,
    quantite: Number(quantite),
    note: note as string | null,
    creePar: creePar as string | null,
    creeLe: creeLe as string,
    modifieLe: modifieLe as string | null,
  }));
  const mouvements: (Mouvement & Horodate)[] = [
    ...pointages.map((p, i) => {
      const precedent = i > 0 ? pointages[i - 1] : null;
      // Les ajouts entre le pointage précédent et celui-ci font partie de ce qui était prévu.
      const entre = precedent ? ajouts.filter((a) => ajoutApres(a, precedent) && !ajoutApres(a, p)) : [];
      const depart = recaler(precedent && { date: precedent.date, quantite: precedent.quantite }, entre, s.traitements);
      return { ...p, type: "pointage" as const, attendu: depart ? Math.max(0, estimerAu(depart, s.traitements, p.date)) : null };
    }),
    ...ajouts.map((a) => ({ ...a, type: "ajout" as const, attendu: null })),
  ];
  // Du plus récent au plus ancien ; le même jour, le dernier saisi d'abord (même seconde : l'ajout passe après le pointage).
  mouvements.sort((a, b) => b.date.localeCompare(a.date) || b.creeLe.localeCompare(a.creeLe) || (a.type === b.type ? 0 : a.type === "ajout" ? -1 : 1));
  return { ...s, mouvements: mouvements.map(({ creeLe: _creeLe, ...m }): Mouvement => m) };
}

/** Traitements en cours qui ne puisent dans aucun stock (médicament sans stock) : à créer. */
export async function traitementsSansStock() {
  const stocks = (await listeStocks({ archives: true })) as LigneStock[];
  const jour = aujourdhui();
  const sans = (await traitementsAvecStock(stocks)).filter((t) => !t.stockId && (!t.traitement.fin || t.traitement.fin >= jour));
  if (!sans.length) return [];
  const noms = new Map((await query("select id, nom from medicament")).map(([i, n]) => [i as string, n as string]));
  return sans.map((t) => ({ ...t.traitement, medicamentId: t.medicamentId, medicament: noms.get(t.medicamentId) ?? "" }));
}

/** Stocks pour la saisie rapide d'un pointage : libellé, unité, estimation de ce soir. */
export async function stocksAPointer() {
  return (await listeStocks()).map((s) => ({
    id: s.id,
    libelle: `${s.medicament} — ${s.prenom ?? "partagé"}`,
    unite: s.unite,
    estime: s.etat.estime,
    dernier: s.etat.pointage?.date ?? null,
  }));
}

// --- Écriture

async function verifierUnique(medicamentId: string, personneId: string | null, sauf = "") {
  const meme = await query("select 1 from stock where medicament_id = ? and personne_id is ? and archive = 0 and id <> ?", [medicamentId, personneId, sauf]);
  if (meme.length) throw new ErreurMetier(personneId ? "Cette personne a déjà son stock de ce médicament." : "Ce médicament a déjà un stock partagé.");
}

function verifierQuantite(q: number) {
  if (!Number.isInteger(q) || q < 0 || q > 400_000) throw new ErreurMetier("Quantité invalide (par quart d'unité).");
}

function verifierDatePointage(date: string) {
  if (!DATE.test(date)) throw new ErreurMetier("Date invalide.");
  if (date > aujourdhui()) throw new ErreurMetier("Un pointage ne peut pas être dans le futur.");
  if (date < ajouterJours(aujourdhui(), -3660)) throw new ErreurMetier("Date trop ancienne.");
}

/**
 * Nouveau stock : partagé (`personneId` vide) ou propre à une personne. `pointage` : le premier comptage (facultatif).
 * Renvoie son identifiant.
 */
export async function creerStock(v: { medicamentId: string; personneId?: string | null; pointage?: { date: string; quantite: number } | null }) {
  await exiger("medicament", v.medicamentId, "Médicament inconnu.");
  if (v.personneId) await exiger("personne", v.personneId, "Personne inconnue.");
  await verifierUnique(v.medicamentId, v.personneId ?? null);
  if (v.pointage) {
    verifierDatePointage(v.pointage.date);
    verifierQuantite(v.pointage.quantite);
  }
  const id = newId();
  await query("insert into stock (id, medicament_id, personne_id) values (?, ?, ?)", [id, v.medicamentId, v.personneId ?? null]);
  if (v.pointage) await query("insert into pointage (id, stock_id, date, quantite) values (?, ?, ?, ?)", [newId(), id, v.pointage.date, v.pointage.quantite]);
  return id;
}

/**
 * Modifie un stock : partagé (`personneId` null) ou propre à une personne. Les traitements suivent la règle
 * (propre d'abord, sinon partagé). Refusé s'il existe déjà un stock actif de même nature.
 */
export async function majStock(id: string, patch: { personneId?: string | null }, version?: string | null) {
  const [l] = await query("select medicament_id, archive from stock where id = ?", [id]);
  if (!l) throw new ErreurMetier("Stock introuvable.", 404);
  await verifierVersion("stock", id, version);
  if (patch.personneId !== undefined) {
    const personneId = patch.personneId || null;
    if (personneId) await exiger("personne", personneId, "Personne inconnue.");
    if (!l[1]) await verifierUnique(l[0] as string, personneId, id);
    await query("update stock set personne_id = ? where id = ?", [personneId, id]);
  }
  return versionDe("stock", id);
}

/** Archive un stock (plus de boîtes à part, par exemple) : ses traitements puisent alors dans le stock partagé. */
export async function archiverStock(id: string, archive: boolean) {
  const [l] = await query("select medicament_id, personne_id from stock where id = ?", [id]);
  if (!l) throw new ErreurMetier("Stock introuvable.", 404);
  if (!archive) await verifierUnique(l[0] as string, l[1] as string | null, id);
  await query("update stock set archive = ? where id = ?", [archive ? 1 : 0, id]);
}

/** Pointage : le soir de `date`, après les prises, il reste `quantite` (quarts). Recale le calcul. */
export async function pointer(v: { stockId: string; date: string; quantite: number; note?: string | null }) {
  await exiger("stock", v.stockId, "Stock introuvable.");
  verifierDatePointage(v.date);
  verifierQuantite(v.quantite);
  const id = newId();
  await query(`insert into pointage (id, stock_id, date, quantite, note, cree_le) values (?, ?, ?, ?, ?, ?)`, [id, v.stockId, v.date, v.quantite, v.note?.trim() || null, saisiLe()]);
  return id;
}

/** Corrige un pointage (admins) : erreur de comptage ou de date. Le journal garde l'ancien. */
export async function majPointage(id: string, patch: { date?: string; quantite?: number; note?: string | null }, version?: string | null) {
  await exiger("pointage", id, "Pointage introuvable.");
  if (!adminCourant()) throw new ErreurMetier("Seul un admin peut corriger un pointage ; vous pouvez en saisir un nouveau.", 403);
  await verifierVersion("pointage", id, version);
  if (patch.date !== undefined) verifierDatePointage(patch.date);
  if (patch.quantite !== undefined) verifierQuantite(patch.quantite);
  const champs: string[] = [];
  const params: unknown[] = [];
  if (patch.date !== undefined) champs.push("date = ?") && params.push(patch.date);
  if (patch.quantite !== undefined) champs.push("quantite = ?") && params.push(patch.quantite);
  if (patch.note !== undefined) champs.push("note = ?") && params.push(patch.note?.trim() || null);
  if (champs.length) await query(`update pointage set ${champs.join(", ")} where id = ?`, [...params, id]);
  return versionDe("pointage", id);
}

/** Supprime un pointage saisi par erreur (admins). Le journal garde la fiche. */
export async function supprimerPointage(id: string) {
  await exiger("pointage", id, "Pointage introuvable.");
  if (!adminCourant()) throw new ErreurMetier("Seul un admin peut supprimer un pointage.", 403);
  await query("delete from pointage where id = ?", [id]);
}

/**
 * Ce que donnerait un ajout (fenêtre « Réapprovisionner ») : le point de départ du calcul (dernier pointage ou ajout),
 * le restant prévu ce soir-là et le total après l'ajout. `sansEffet` : daté d'avant le dernier pointage, qui l'a déjà
 * compté.
 */
export async function apercuAjout(v: { stockId: string; date: string; quantite: number }) {
  const s = (await listeStocks({ archives: true, jour: v.date })).find((x) => x.id === v.stockId);
  if (!s) throw new ErreurMetier("Stock introuvable.", 404);
  // Le dernier pointage n'est pas filtré par la date de l'aperçu : il peut être postérieur à l'ajout.
  const sansEffet = !!s.etat.pointage && v.date < s.etat.pointage.date;
  const prevu = sansEffet ? null : (s.etat.estime ?? 0);
  return { pointage: s.etat.pointage, depart: s.etat.depart, prevu, apres: prevu === null ? null : prevu + v.quantite, sansEffet };
}

/** Réapprovisionnement : le `date`, on a ajouté `quantite` (quarts) sans recompter. Renvoie son identifiant. */
export async function ajouter(v: { stockId: string; date: string; quantite: number; note?: string | null }) {
  await exiger("stock", v.stockId, "Stock introuvable.");
  verifierDatePointage(v.date);
  verifierAjout(v.quantite);
  const id = newId();
  await query(`insert into ajout (id, stock_id, date, quantite, note, cree_le) values (?, ?, ?, ?, ?, ?)`, [id, v.stockId, v.date, v.quantite, v.note?.trim() || null, saisiLe()]);
  return id;
}

function verifierAjout(q: number) {
  verifierQuantite(q);
  if (q === 0) throw new ErreurMetier("Indiquez la quantité ajoutée.");
}

/** Corrige un ajout (admins). Le journal garde l'ancien. */
export async function majAjout(id: string, patch: { date?: string; quantite?: number; note?: string | null }, version?: string | null) {
  await exiger("ajout", id, "Ajout introuvable.");
  if (!adminCourant()) throw new ErreurMetier("Seul un admin peut corriger un ajout.", 403);
  await verifierVersion("ajout", id, version);
  if (patch.date !== undefined) verifierDatePointage(patch.date);
  if (patch.quantite !== undefined) verifierAjout(patch.quantite);
  const champs: string[] = [];
  const params: unknown[] = [];
  if (patch.date !== undefined) champs.push("date = ?") && params.push(patch.date);
  if (patch.quantite !== undefined) champs.push("quantite = ?") && params.push(patch.quantite);
  if (patch.note !== undefined) champs.push("note = ?") && params.push(patch.note?.trim() || null);
  if (champs.length) await query(`update ajout set ${champs.join(", ")} where id = ?`, [...params, id]);
  return versionDe("ajout", id);
}

/** Supprime un ajout saisi par erreur (admins). Le journal garde la fiche. */
export async function supprimerAjout(id: string) {
  await exiger("ajout", id, "Ajout introuvable.");
  if (!adminCourant()) throw new ErreurMetier("Seul un admin peut supprimer un ajout.", 403);
  await query("delete from ajout where id = ?", [id]);
}

export type LigneARenouveler = {
  stockId: string;
  medicament: string;
  unite: string;
  etat: EtatStock;
  /** Posologie de cette personne pour ce médicament. */
  posologie: Posologie | null;
  /** Stock partagé : les autres personnes qui y puisent. */
  partageAvec: string[];
};

/**
 * Page « À renouveler » : par personne, les médicaments en alerte ou épuisés (un stock partagé figure chez chaque
 * personne qui y puise : chacune a son ordonnance) ; puis les stocks jamais pointés, et les prochaines échéances.
 */
export async function aRenouveler(f: { jour?: string } = {}) {
  const jour = f.jour ?? aujourdhui();
  const stocks = await listeStocks({ jour });
  const personnes = (await query("select id, prenom from personne where archivee = 0 order by ordre, prenom")).map(([id, prenom]) => ({ id: id as string, prenom: prenom as string }));
  const enCours = (s: StockCalcule) => s.traitements.filter((t) => !t.fin || t.fin >= jour);
  const urgents = stocks.filter((s) => s.etat.statut === "alerte" || s.etat.statut === "epuise");
  const parPersonne = personnes
    .map((p) => ({
      ...p,
      lignes: urgents.flatMap((s): LigneARenouveler[] => {
        const siens = enCours(s).filter((t) => t.personneId === p.id);
        if (!siens.length) return [];
        return [
          {
            stockId: s.id,
            medicament: s.medicament,
            unite: s.unite,
            etat: s.etat,
            posologie: siens[0].posologie,
            partageAvec: [...new Set(enCours(s).filter((t) => t.personneId !== p.id).map((t) => t.prenom))],
          },
        ];
      }),
    }))
    .filter((p) => p.lignes.length);
  return {
    jour,
    parPersonne,
    /** Stocks en alerte sans traitement en cours (rare : seuil d'un stock que plus personne ne prend). */
    autres: urgents.filter((s) => !enCours(s).length),
    aPointer: stocks.filter((s) => s.etat.statut === "inconnu" && enCours(s).length),
    prochaines: stocks.filter((s) => s.etat.statut === "ok" && s.etat.epuisement).slice(0, 6),
    nbPersonnes: personnes.length,
  };
}
