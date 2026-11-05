import { describe, expect, test } from "bun:test";
import { ajouterJours, aujourdhui } from "../src/lib/dates";
import { SUPER, serveurDeTest } from "./outils-serveur";

const s = await serveurDeTest();
const { cookie } = await s.connexion(SUPER.email, SUPER.motDePasse);
const ecrivain = await s.compte("ecriture@famille.fr", "ecriture");

const appel = async (nom: string, args: unknown[], c = cookie) => {
  const r = await s.rpc(nom, args, c);
  const corps = await r.json();
  return { statut: r.status, resultat: corps.resultat, erreur: corps.erreur as string | undefined };
};
const ok = async (nom: string, ...args: unknown[]) => {
  const r = await appel(nom, args);
  if (r.statut !== 200) throw new Error(`${nom} : ${r.statut} ${r.erreur}`);
  return r.resultat;
};

const C = 4;
const jour = aujourdhui();
const ilYA = (n: number) => ajouterJours(jour, -n);
const unParJour = { moments: { matin: C }, rythme: { type: "quotidien" } };

const jeanne = await ok("creerPersonne", { prenom: "Jeanne" });
const robert = await ok("creerPersonne", { prenom: "Robert" });
type Stock = { id: string; medicamentId: string; personneId: string | null; traitements: { prenom: string }[]; etat: Record<string, unknown> };
const stocksDe = async (medicamentId: string): Promise<Stock[]> => (await ok("listeStocks")).filter((x: Stock) => x.medicamentId === medicamentId);

describe("stocks", () => {
  test("premier traitement d'un médicament : stock partagé créé ; le second traitement y puise aussi", async () => {
    const med = await ok("creerMedicament", { nom: "Doliprane" });
    await ok("creerTraitement", { personneId: jeanne, medicamentId: med, posologie: unParJour, debut: ilYA(30) });
    await ok("creerTraitement", { personneId: robert, medicamentId: med, posologie: unParJour, debut: ilYA(30) });
    const [partage] = await stocksDe(med);
    expect(partage.personneId).toBeNull();
    expect(partage.traitements.map((t) => t.prenom).sort()).toEqual(["Jeanne", "Robert"]);
    expect(partage.etat.statut).toBe("inconnu");
  });

  test("stock propre : le traitement de sa personne y puise, les autres restent sur le partagé ; un seul par personne", async () => {
    const med = await ok("creerMedicament", { nom: "Kardégic" });
    await ok("creerTraitement", { personneId: jeanne, medicamentId: med, posologie: unParJour, debut: ilYA(30) });
    await ok("creerTraitement", { personneId: robert, medicamentId: med, posologie: unParJour, debut: ilYA(30) });
    const propre = await ok("creerStock", { medicamentId: med, personneId: robert, pointage: { date: jour, quantite: 10 * C } });
    const stocks = await stocksDe(med);
    expect(stocks.find((x) => x.id === propre)!.traitements.map((t) => t.prenom)).toEqual(["Robert"]);
    expect(stocks.find((x) => x.personneId === null)!.traitements.map((t) => t.prenom)).toEqual(["Jeanne"]);
    expect((await appel("creerStock", [{ medicamentId: med, personneId: robert }])).erreur).toBe("Cette personne a déjà son stock de ce médicament.");
    expect((await appel("creerStock", [{ medicamentId: med }])).erreur).toBe("Ce médicament a déjà un stock partagé.");
    // Stock propre archivé : Robert revient sur le stock partagé.
    await ok("archiverStock", propre, true);
    expect((await stocksDe(med))[0].traitements.length).toBe(2);
  });

  test("modifier un stock : partagé ↔ propre, les traitements suivent ; doublon refusé", async () => {
    const med = await ok("creerMedicament", { nom: "Tahor" });
    await ok("creerTraitement", { personneId: jeanne, medicamentId: med, posologie: unParJour, debut: ilYA(30) });
    await ok("creerTraitement", { personneId: robert, medicamentId: med, posologie: unParJour, debut: ilYA(30) });
    const [partage] = await stocksDe(med);
    // Partagé → propre à Jeanne : Robert n'a plus de stock.
    await ok("majStock", partage.id, { personneId: jeanne });
    let [st] = await stocksDe(med);
    expect(st.personneId).toBe(jeanne);
    expect(st.traitements.map((t) => t.prenom)).toEqual(["Jeanne"]);
    expect((await ok("traitementsSansStock")).some((t: { medicamentId: string; prenom: string }) => t.medicamentId === med && t.prenom === "Robert")).toBe(true);
    // Un stock propre à Robert existe : impossible de faire du stock de Jeanne celui de Robert.
    const deRobert = await ok("creerStock", { medicamentId: med, personneId: robert });
    expect((await appel("majStock", [partage.id, { personneId: robert }])).erreur).toBe("Cette personne a déjà son stock de ce médicament.");
    // Retour au partagé (par le rôle écriture) : Jeanne y puise, Robert garde son stock propre.
    expect((await appel("majStock", [partage.id, { personneId: null }], ecrivain.cookie)).statut).toBe(200);
    [st] = (await stocksDe(med)).filter((x) => x.id === partage.id);
    expect(st.personneId).toBeNull();
    expect(st.traitements.map((t) => t.prenom)).toEqual(["Jeanne"]);
    expect((await stocksDe(med)).find((x) => x.id === deRobert)!.traitements.map((t) => t.prenom)).toEqual(["Robert"]);
    // Un second stock partagé est refusé.
    expect((await appel("majStock", [deRobert, { personneId: null }])).erreur).toBe("Ce médicament a déjà un stock partagé.");
  });

  test("pointage : recale le stock estimé et la date d'épuisement ; le plus récent l'emporte", async () => {
    const med = await ok("creerMedicament", { nom: "Levothyrox" });
    await ok("creerTraitement", { personneId: jeanne, medicamentId: med, posologie: unParJour, debut: ilYA(60) });
    const [st] = await stocksDe(med);
    await ok("pointer", { stockId: st.id, date: ilYA(10), quantite: 30 * C });
    expect((await stocksDe(med))[0].etat).toMatchObject({ statut: "ok", estime: 20 * C, epuisement: ajouterJours(jour, 21) });
    // Une boîte perdue : on recompte, il en reste moins que prévu.
    await ok("pointer", { stockId: st.id, date: jour, quantite: 5 * C });
    expect((await stocksDe(med))[0].etat).toMatchObject({ statut: "alerte", estime: 5 * C, epuisement: ajouterJours(jour, 6) });
    expect((await appel("pointer", [{ stockId: st.id, date: ajouterJours(jour, 1), quantite: 4 }])).erreur).toBe("Un pointage ne peut pas être dans le futur.");
    expect((await appel("pointer", [{ stockId: st.id, date: jour, quantite: 1.5 }])).statut).toBe(400);
  });

  test("fiche : pointages du plus récent au plus ancien, avec ce que le calcul prévoyait ; historique du stock", async () => {
    const med = await ok("creerMedicament", { nom: "Aspégic" });
    await ok("creerTraitement", { personneId: robert, medicamentId: med, posologie: unParJour, debut: ilYA(60) });
    const [st] = await stocksDe(med);
    await ok("pointer", { stockId: st.id, date: ilYA(5), quantite: 20 * C });
    await ok("pointer", { stockId: st.id, date: jour, quantite: 13 * C, note: "une boîte retrouvée" });
    const f = await ok("ficheStock", st.id);
    expect(f.mouvements.map((p: { quantite: number; attendu: number | null }) => [p.quantite, p.attendu])).toEqual([
      [13 * C, 15 * C],
      [20 * C, null],
    ]);
    const { lignes } = await (await s.requete(`/api/journal?cible=${st.id}`, { cookie })).json();
    expect(lignes.filter((l: { fonction: string }) => l.fonction === "pointer").length).toBe(2);
    expect(JSON.parse(lignes[0].apres).stock).toBe("Aspégic — partagé");
  });

  test("réapprovisionnement : restant prévu + ajout ; même jour, le dernier saisi l'emporte ; écart du pointage suivant", async () => {
    const med = await ok("creerMedicament", { nom: "Crestor" });
    await ok("creerTraitement", { personneId: jeanne, medicamentId: med, posologie: unParJour, debut: ilYA(60) });
    const [st] = await stocksDe(med);
    await ok("pointer", { stockId: st.id, date: ilYA(10), quantite: 20 * C });
    // Le 4e jour : 20 − 4 = 16 prévus, + 30.
    expect(await ok("apercuAjout", { stockId: st.id, date: ilYA(6), quantite: 30 * C })).toMatchObject({ prevu: 16 * C, apres: 46 * C, sansEffet: false });
    await ok("ajouter", { stockId: st.id, date: ilYA(6), quantite: 30 * C, note: "Pharmacie" });
    let [s1] = await stocksDe(med);
    expect(s1.etat.estime).toBe(40 * C);
    // Daté d'avant le dernier pointage : signalé sans effet.
    expect((await ok("apercuAjout", { stockId: st.id, date: ilYA(12), quantite: 5 * C })).sansEffet).toBe(true);
    // Pointage ce soir (compte ce qui est là), puis un ajout saisi après, le même jour : il s'y ajoute.
    await ok("pointer", { stockId: st.id, date: jour, quantite: 38 * C });
    await ok("ajouter", { stockId: st.id, date: jour, quantite: 10 * C });
    [s1] = await stocksDe(med);
    expect(s1.etat.estime).toBe(48 * C);
    // Un pointage saisi ensuite, le même jour, le remplace.
    await ok("pointer", { stockId: st.id, date: jour, quantite: 47 * C });
    [s1] = await stocksDe(med);
    expect(s1.etat.estime).toBe(47 * C);
    // Fiche : du plus récent au plus ancien ; l'écart tient compte des ajouts entre deux pointages.
    const f = await ok("ficheStock", st.id);
    expect(f.mouvements.map((m: { type: string; quantite: number; attendu: number | null }) => [m.type, m.quantite / C, m.attendu === null ? null : m.attendu / C])).toEqual([
      ["pointage", 47, 48],
      ["ajout", 10, null],
      ["pointage", 38, 40],
      ["ajout", 30, null],
      ["pointage", 20, null],
    ]);
  });

  test("réapprovisionnement : droits, quantité nulle, date future, correction et suppression par un admin", async () => {
    const med = await ok("creerMedicament", { nom: "Mopral" });
    const st = await ok("creerStock", { medicamentId: med });
    const a = (await appel("ajouter", [{ stockId: st, date: jour, quantite: 8 }], ecrivain.cookie)).resultat;
    expect(typeof a).toBe("string");
    expect((await appel("ajouter", [{ stockId: st, date: jour, quantite: 0 }])).erreur).toBe("Indiquez la quantité ajoutée.");
    expect((await appel("ajouter", [{ stockId: st, date: ajouterJours(jour, 1), quantite: 4 }])).erreur).toBe("Un pointage ne peut pas être dans le futur.");
    expect((await appel("majAjout", [a, { quantite: 12 }], ecrivain.cookie)).statut).toBe(403);
    expect((await appel("supprimerAjout", [a], ecrivain.cookie)).statut).toBe(403);
    await ok("majAjout", a, { quantite: 12 });
    expect((await ok("listeStocks")).find((x: Stock) => x.id === st).etat.estime).toBe(12);
    const { lignes } = await (await s.requete(`/api/journal?cible=${st}`, { cookie })).json();
    expect(lignes.some((l: { fonction: string }) => l.fonction === "majAjout")).toBe(true);
    await ok("supprimerAjout", a);
    expect((await ok("listeStocks")).find((x: Stock) => x.id === st).etat.statut).toBe("inconnu");
  });

  test("sans posologie : seul le seuil du médicament alerte", async () => {
    const med = await ok("creerMedicament", { nom: "Spasfon", seuilAlerte: 10 * C });
    await ok("creerTraitement", { personneId: robert, medicamentId: med, posologie: null, debut: ilYA(60) });
    const [st] = await stocksDe(med);
    await ok("pointer", { stockId: st.id, date: jour, quantite: 12 * C });
    expect((await stocksDe(med))[0].etat.statut).toBe("ok");
    await ok("pointer", { stockId: st.id, date: jour, quantite: 8 * C });
    expect((await stocksDe(med))[0].etat).toMatchObject({ statut: "alerte", sousSeuil: true, epuisement: null });
  });

  test("droits : le rôle écriture pointe, seul un admin corrige ou supprime un pointage", async () => {
    const med = await ok("creerMedicament", { nom: "Inexium" });
    const st = await ok("creerStock", { medicamentId: med });
    const p = (await appel("pointer", [{ stockId: st, date: jour, quantite: 8 }], ecrivain.cookie)).resultat;
    expect(typeof p).toBe("string");
    expect((await appel("majPointage", [p, { quantite: 12 }], ecrivain.cookie)).statut).toBe(403);
    expect((await appel("supprimerPointage", [p], ecrivain.cookie)).statut).toBe(403);
    expect((await appel("majPointage", [p, { quantite: 12 }])).statut).toBe(200);
    expect((await ok("ficheStock", st)).mouvements[0].quantite).toBe(12);
    expect((await appel("supprimerPointage", [p])).statut).toBe(200);
  });

  test("traitement en cours sans stock signalé ; saisie rapide : libellés et estimation", async () => {
    const med = await ok("creerMedicament", { nom: "Xarelto" });
    await ok("creerTraitement", { personneId: jeanne, medicamentId: med, posologie: unParJour, debut: ilYA(5) });
    const [st] = await stocksDe(med);
    await ok("archiverStock", st.id, true);
    expect((await ok("traitementsSansStock")).map((t: { medicament: string }) => t.medicament)).toContain("Xarelto");
    await ok("archiverStock", st.id, false);
    expect((await ok("traitementsSansStock")).map((t: { medicament: string }) => t.medicament)).not.toContain("Xarelto");
    expect((await ok("stocksAPointer")).find((x: { id: string }) => x.id === st.id).libelle).toBe("Xarelto — partagé");
  });
});

describe("stock à date", () => {
  type Ligne = { stockId: string; manque: number | null; reste: number | null; besoin: number | null; pour: string[] };
  test("il manque = besoin jusqu'à la date − ce soir ; couvert avec le reste ; si besoin et jamais pointé : pas de calcul", async () => {
    const dans = (n: number) => ajouterJours(jour, n);
    const manque = await ok("creerMedicament", { nom: "Eliquis" });
    await ok("creerTraitement", { personneId: jeanne, medicamentId: manque, posologie: unParJour, debut: ilYA(30) });
    await ok("creerTraitement", { personneId: robert, medicamentId: manque, posologie: unParJour, debut: ilYA(30) });
    const [sm] = await stocksDe(manque);
    await ok("pointer", { stockId: sm.id, date: jour, quantite: 23 * C });
    const couvert = await ok("creerMedicament", { nom: "Amlor" });
    await ok("creerTraitement", { personneId: robert, medicamentId: couvert, posologie: unParJour, debut: ilYA(30) });
    const [sc] = await stocksDe(couvert);
    await ok("pointer", { stockId: sc.id, date: jour, quantite: 55 * C });
    const siBesoin = await ok("creerMedicament", { nom: "Spifen" });
    await ok("creerTraitement", { personneId: jeanne, medicamentId: siBesoin, posologie: null, debut: ilYA(30) });
    const [sb] = await stocksDe(siBesoin);
    await ok("pointer", { stockId: sb.id, date: jour, quantite: 30 * C });

    const { lignes } = await ok("stockADate", { jusquau: dans(40) });
    const de = (id: string) => lignes.find((l: Ligne) => l.stockId === id) as Ligne;
    expect(de(sm.id)).toMatchObject({ besoin: 80 * C, manque: 57 * C, reste: 0 });
    expect(de(sm.id).pour.sort()).toEqual(["Jeanne", "Robert"]);
    expect(de(sc.id)).toMatchObject({ besoin: 40 * C, manque: 0, reste: 15 * C });
    expect(de(sb.id)).toMatchObject({ besoin: null, manque: null });
    // Ceux qui manquent d'abord, puis les couverts, puis ceux sans calcul.
    const ordre = lignes.map((l: Ligne) => l.stockId);
    expect(ordre.indexOf(sm.id)).toBeLessThan(ordre.indexOf(sc.id));
    expect(ordre.indexOf(sc.id)).toBeLessThan(ordre.indexOf(sb.id));

    expect((await appel("stockADate", [{ jusquau: ilYA(1) }])).erreur).toBe("Choisissez aujourd'hui ou une date à venir.");
    expect((await ok("stockADate", { jusquau: jour })).lignes.find((l: Ligne) => l.stockId === sm.id).besoin).toBe(0);
  });
});

describe("à renouveler", () => {
  test("par personne : un stock partagé figure chez chacune ; jamais pointés à part ; prochaines échéances", async () => {
    const paul = await ok("creerPersonne", { prenom: "Paul" });
    const lucie = await ok("creerPersonne", { prenom: "Lucie" });
    const commun = await ok("creerMedicament", { nom: "Commun" });
    const tranquille = await ok("creerMedicament", { nom: "Tranquille" });
    const jamais = await ok("creerMedicament", { nom: "Jamais compté" });
    await ok("creerTraitement", { personneId: paul, medicamentId: commun, posologie: unParJour, debut: ilYA(10) });
    await ok("creerTraitement", { personneId: lucie, medicamentId: commun, posologie: unParJour, debut: ilYA(10) });
    await ok("creerTraitement", { personneId: lucie, medicamentId: tranquille, posologie: unParJour, debut: ilYA(10) });
    await ok("creerTraitement", { personneId: paul, medicamentId: jamais, posologie: unParJour, debut: ilYA(10) });
    const [stCommun] = await stocksDe(commun);
    const [stTranquille] = await stocksDe(tranquille);
    await ok("pointer", { stockId: stCommun.id, date: jour, quantite: 6 * C }); // 2 par jour : 3 jours
    await ok("pointer", { stockId: stTranquille.id, date: jour, quantite: 60 * C });

    const r = await ok("aRenouveler");
    const de = (prenom: string) => r.parPersonne.find((p: { prenom: string }) => p.prenom === prenom)?.lignes ?? [];
    expect(de("Paul").map((l: { medicament: string; partageAvec: string[] }) => [l.medicament, l.partageAvec])).toEqual([["Commun", ["Lucie"]]]);
    expect(de("Lucie").map((l: { medicament: string }) => l.medicament)).toEqual(["Commun"]);
    expect(r.aPointer.map((s: { medicament: string }) => s.medicament)).toContain("Jamais compté");
    expect(r.prochaines.map((s: { medicament: string }) => s.medicament)).toContain("Tranquille");
  });
});
