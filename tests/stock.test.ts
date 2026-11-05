import { describe, expect, test } from "bun:test";
import { besoinJusquau, calculerStock, dateEpuisement, delaiDuStock, estimerAu, recaler, type TraitementDuStock } from "../src/lib/stock";
import type { Posologie } from "../src/lib/posologie";

const quotidien = (q: number, debut = "2026-01-01", fin: string | null = null, delaiAlerte: number | null = null): TraitementDuStock => ({
  posologie: { moments: { matin: q }, rythme: { type: "quotidien" } } as Posologie,
  debut,
  fin,
  delaiAlerte,
});
const C = 4; // un comprimé, en quarts

describe("stock estimé", () => {
  test("le soir du pointage : le pointage ; la consommation reprend le lendemain", () => {
    const p = { date: "2026-11-01", quantite: 30 * C };
    expect(estimerAu(p, [quotidien(C)], "2026-11-01")).toBe(30 * C);
    expect(estimerAu(p, [quotidien(C)], "2026-11-02")).toBe(29 * C);
    expect(estimerAu(p, [quotidien(C)], "2026-11-11")).toBe(20 * C);
  });

  test("deux traitements sur un stock partagé s'additionnent ; demi-comprimés", () => {
    const p = { date: "2026-11-01", quantite: 10 * C };
    expect(estimerAu(p, [quotidien(C), quotidien(2)], "2026-11-03")).toBe(10 * C - 2 * (C + 2));
  });

  test("un traitement pas encore commencé ou terminé ne consomme pas", () => {
    const p = { date: "2026-11-01", quantite: 10 * C };
    expect(estimerAu(p, [quotidien(C, "2026-11-05")], "2026-11-06")).toBe(8 * C);
    expect(estimerAu(p, [quotidien(C, "2026-01-01", "2026-11-02")], "2026-11-10")).toBe(9 * C);
  });
});

describe("date d'épuisement", () => {
  test("premier jour non couvert", () => {
    // 3 comprimés, 1 par jour à partir du 2 : couverts les 2, 3 et 4 ; le 5 ne l'est plus.
    expect(dateEpuisement({ date: "2026-11-01", quantite: 3 * C }, [quotidien(C)])).toBe("2026-11-05");
    // 2 ½ comprimés : le 4, il reste ½ pour 1 : non couvert.
    expect(dateEpuisement({ date: "2026-11-01", quantite: 10 }, [quotidien(C)])).toBe("2026-11-04");
  });

  test("un jour sur deux, à partir du début du traitement", () => {
    const t: TraitementDuStock = { posologie: { moments: { midi: C }, rythme: { type: "tous_les", jours: 2 } }, debut: "2026-11-01", fin: null, delaiAlerte: null };
    // Prises les 3, 5, 7… ; 2 comprimés couvrent les 3 et 5 ; le 7 n'est pas couvert.
    expect(dateEpuisement({ date: "2026-11-01", quantite: 2 * C }, [t])).toBe("2026-11-07");
  });

  test("jamais : sans posologie, ou traitement fini avant l'épuisement", () => {
    expect(dateEpuisement({ date: "2026-11-01", quantite: 0 }, [{ posologie: null, debut: "2026-01-01", fin: null, delaiAlerte: null }])).toBeNull();
    expect(dateEpuisement({ date: "2026-11-01", quantite: 10 * C }, [quotidien(C, "2026-01-01", "2026-11-05")])).toBeNull();
    expect(dateEpuisement({ date: "2026-11-01", quantite: 2 * C }, [quotidien(C, "2026-01-01", "2026-11-05")])).toBe("2026-11-04");
  });
});

describe("délai et statut", () => {
  const base = { aujourdhui: "2026-11-10", delaiGeneral: 7, seuil: null };

  test("délai : le plus grand des traitements en cours, sinon le délai général", () => {
    expect(delaiDuStock([quotidien(C), quotidien(C, "2026-01-01", null, 14)], "2026-11-10", 7)).toBe(14);
    expect(delaiDuStock([quotidien(C, "2026-01-01", null, 3)], "2026-11-10", 7)).toBe(3);
    expect(delaiDuStock([quotidien(C, "2026-01-01", "2026-02-01", 30)], "2026-11-10", 7)).toBe(7);
  });

  test("ok, puis alerte dans le délai, puis épuisé le jour non couvert", () => {
    const p = { date: "2026-11-01", quantite: 30 * C };
    // 30 comprimés, un par jour à partir du 2 nov. : couverts jusqu'au 1er déc. ; le 2 déc. ne l'est plus.
    const e = calculerStock({ ...base, pointage: p, traitements: [quotidien(C)] });
    expect(e).toMatchObject({ statut: "ok", estime: 21 * C, epuisement: "2026-12-02", alerteLe: "2026-11-25", delai: 7 });
    expect(calculerStock({ ...base, aujourdhui: "2026-11-25", pointage: p, traitements: [quotidien(C)] }).statut).toBe("alerte");
    expect(calculerStock({ ...base, aujourdhui: "2026-12-02", pointage: p, traitements: [quotidien(C)] })).toMatchObject({ statut: "epuise", estime: 0 });
  });

  test("délai propre au traitement (surcharge)", () => {
    const p = { date: "2026-11-01", quantite: 30 * C };
    expect(calculerStock({ ...base, pointage: p, traitements: [quotidien(C, "2026-01-01", null, 30)] }).statut).toBe("alerte");
  });

  test("sans pointage : inconnu ; sans posologie ni seuil : sans suivi ; seuil franchi : alerte", () => {
    expect(calculerStock({ ...base, pointage: null, traitements: [quotidien(C)] }).statut).toBe("inconnu");
    const siBesoin: TraitementDuStock = { posologie: null, debut: "2026-01-01", fin: null, delaiAlerte: null };
    const p = { date: "2026-11-01", quantite: 8 * C };
    expect(calculerStock({ ...base, pointage: p, traitements: [siBesoin] }).statut).toBe("sans_suivi");
    expect(calculerStock({ ...base, pointage: p, traitements: [siBesoin], seuil: 10 * C })).toMatchObject({ statut: "alerte", sousSeuil: true });
    expect(calculerStock({ ...base, pointage: p, traitements: [siBesoin], seuil: 5 * C }).statut).toBe("ok");
  });
});

describe("réapprovisionnement", () => {
  const p = { date: "2026-11-01", quantite: 10 * C };
  test("l'ajout repart du restant prévu ce soir-là + la quantité ajoutée", () => {
    expect(recaler(p, [{ date: "2026-11-05", quantite: 30 * C }], [quotidien(C)])).toEqual({ date: "2026-11-05", quantite: 36 * C });
    // Le même soir que le pointage : il s'y ajoute.
    expect(recaler(p, [{ date: "2026-11-01", quantite: 5 * C }], [quotidien(C)])).toEqual({ date: "2026-11-01", quantite: 15 * C });
  });

  test("restant prévu épuisé : on repart de zéro, jamais d'un stock négatif", () => {
    expect(recaler(p, [{ date: "2026-11-20", quantite: 30 * C }], [quotidien(C)])).toEqual({ date: "2026-11-20", quantite: 30 * C });
  });

  test("plusieurs ajouts s'enchaînent, dans l'ordre des dates ; sans pointage, le premier part de zéro", () => {
    const ajouts = [
      { date: "2026-11-08", quantite: 2 * C },
      { date: "2026-11-03", quantite: 4 * C },
    ];
    // 10 − 2 + 4 = 12 le 3 ; 12 − 5 + 2 = 9 le 8.
    expect(recaler(p, ajouts, [quotidien(C)])).toEqual({ date: "2026-11-08", quantite: 9 * C });
    expect(recaler(null, [{ date: "2026-11-03", quantite: 4 * C }], [quotidien(C)])).toEqual({ date: "2026-11-03", quantite: 4 * C });
    expect(recaler(null, [], [quotidien(C)])).toBeNull();
  });

  test("calcul du stock : estimation et épuisement partent de l'ajout ; le pointage affiché reste le comptage", () => {
    const e = calculerStock({ pointage: p, ajouts: [{ date: "2026-11-05", quantite: 30 * C }], traitements: [quotidien(C)], aujourdhui: "2026-11-10", delaiGeneral: 7, seuil: null });
    expect(e.pointage).toEqual(p);
    expect(e.depart).toEqual({ date: "2026-11-05", quantite: 36 * C });
    expect(e.estime).toBe(31 * C);
    expect(e.epuisement).toBe("2026-12-12");
  });
});

describe("stock à date", () => {
  test("besoin : prises du lendemain jusqu'au soir choisi inclus ; dates de début et de fin comprises", () => {
    expect(besoinJusquau([quotidien(C)], "2026-11-05", "2026-11-05")).toBe(0);
    expect(besoinJusquau([quotidien(C)], "2026-11-05", "2026-12-15")).toBe(40 * C);
    expect(besoinJusquau([quotidien(C), quotidien(2)], "2026-11-05", "2026-11-15")).toBe(10 * (C + 2));
    expect(besoinJusquau([quotidien(C, "2026-11-10", "2026-11-12")], "2026-11-05", "2026-12-15")).toBe(3 * C);
  });
});
