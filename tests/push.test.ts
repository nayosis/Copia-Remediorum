import { describe, expect, test } from "bun:test";
import { SUPER, serveurDeTest } from "./outils-serveur";
import { abonnementsDe, abonner, chiffrer, clePublique, definirTransport, depuisB64, envoyer, versB64 } from "../serveur/push";
import { baseComptes } from "../serveur/comptes";

const s = await serveurDeTest();
const { cookie } = await s.connexion(SUPER.email, SUPER.motDePasse);
const superId = baseComptes().query<{ id: string }, []>("SELECT id FROM utilisateur WHERE super = 1").get()!.id;

/** Clé EC P-256 depuis sa partie privée (d) et publique (point non compressé). */
async function cleEc(d: string, publique: string, usage: "ECDH") {
  const p = depuisB64(publique);
  const jwk = { kty: "EC", crv: "P-256", d, x: versB64(p.slice(1, 33)), y: versB64(p.slice(33, 65)), ext: true };
  return {
    privateKey: await crypto.subtle.importKey("jwk", jwk, { name: usage, namedCurve: "P-256" }, true, ["deriveBits"]),
    publicKey: await crypto.subtle.importKey("raw", p, { name: usage, namedCurve: "P-256" }, true, []),
  } as CryptoKeyPair;
}

const hkdf = async (sel: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) =>
  new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: sel as Uint8Array<ArrayBuffer>, info: info as Uint8Array<ArrayBuffer> },
      await crypto.subtle.importKey("raw", ikm as Uint8Array<ArrayBuffer>, "HKDF", false, ["deriveBits"]),
      n * 8,
    ),
  );

/** Ce que fait le navigateur à la réception (RFC 8291, côté agent utilisateur) : déchiffre le corps aes128gcm. */
async function dechiffrer(corps: Uint8Array, uaPrive: CryptoKey, uaPublic: Uint8Array, auth: Uint8Array) {
  const sel = corps.slice(0, 16);
  const longueur = corps[20];
  const asPublic = corps.slice(21, 21 + longueur);
  const as = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: as }, uaPrive, 256));
  const info = new Uint8Array([...new TextEncoder().encode("WebPush: info\0"), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(auth, ecdh, info, 32);
  const cek = await hkdf(sel, ikm, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sel, ikm, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const clair = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, corps.slice(21 + longueur)));
  expect(clair.at(-1)).toBe(2);
  return new TextDecoder().decode(clair.slice(0, -1));
}

/** Un abonnement comme en crée un navigateur : sa paire ECDH et son secret d'authentification. */
async function navigateur() {
  const paire = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const publique = new Uint8Array(await crypto.subtle.exportKey("raw", paire.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { paire, publique, auth, abonnement: { endpoint: `https://push.exemple.org/${crypto.randomUUID()}`, p256dh: versB64(publique), auth: versB64(auth) } };
}

describe("Web Push", () => {
  test("chiffrement : exemple de la RFC 8291 (annexe A)", async () => {
    const as = await cleEc("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw", "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8", "ECDH");
    const corps = await chiffrer(
      new TextEncoder().encode("When I grow up, I want to be a watermelon"),
      { endpoint: "https://push.exemple.org/x", p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", auth: "BTBZMqHH6r4Tts7J_aSIgg" },
      as,
      depuisB64("DGv6ra1nlYgDCS1FRnbzlw"),
    );
    expect(versB64(corps)).toBe(
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
    );
  });

  test("envoi : corps déchiffrable par le navigateur, jeton VAPID signé pour l'origine du service", async () => {
    const n = await navigateur();
    let recu: { url: string; init: RequestInit } | null = null;
    definirTransport(async (url, init) => {
      recu = { url, init };
      return new Response(null, { status: 201 });
    });
    expect(await envoyer(n.abonnement, { titre: "Kardégic", texte: "à renouveler", url: "/" })).toBe(201);
    const { url, init } = recu!;
    expect(url).toBe(n.abonnement.endpoint);
    const h = init.headers as Record<string, string>;
    expect(h["content-encoding"]).toBe("aes128gcm");
    expect(JSON.parse(await dechiffrer(init.body as Uint8Array, n.paire.privateKey, n.publique, n.auth))).toEqual({ titre: "Kardégic", texte: "à renouveler", url: "/" });

    const [, jeton, k] = /^vapid t=([^,]+), k=(.+)$/.exec(h.authorization)!;
    expect(k).toBe(await clePublique());
    const [entete, charge, signature] = jeton.split(".");
    expect(JSON.parse(Buffer.from(charge, "base64url").toString())).toMatchObject({ aud: "https://push.exemple.org" });
    const cle = await crypto.subtle.importKey("raw", depuisB64(k), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    expect(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, cle, depuisB64(signature), new TextEncoder().encode(`${entete}.${charge}`))).toBe(true);
  });

  test("abonnement expiré (410) : supprimé", async () => {
    const n = await navigateur();
    abonner(superId, n.abonnement);
    expect(abonnementsDe(superId).some((a) => a.endpoint === n.abonnement.endpoint)).toBe(true);
    definirTransport(async () => new Response(null, { status: 410 }));
    await envoyer(n.abonnement, { titre: "x", texte: "y" });
    expect(abonnementsDe(superId).some((a) => a.endpoint === n.abonnement.endpoint)).toBe(false);
  });

  test("routes : clé publique, abonnement de ses appareils, essai, désabonnement", async () => {
    const n = await navigateur();
    const { cle } = await (await s.requete("/api/push", { cookie })).json();
    expect(depuisB64(cle).length).toBe(65);
    expect((await s.requete("/api/push/abonnement", { corps: { endpoint: n.abonnement.endpoint, keys: { p256dh: n.abonnement.p256dh, auth: n.abonnement.auth }, appareil: "iPhone" }, cookie })).status).toBe(200);
    expect((await s.requete("/api/push/abonnement", { corps: { endpoint: "http://non-chiffre", keys: { p256dh: "x", auth: "y" } }, cookie })).status).toBe(400);
    expect((await (await s.requete("/api/push", { cookie })).json()).appareils).toEqual([{ endpoint: n.abonnement.endpoint, appareil: "iPhone" }]);
    definirTransport(async () => new Response(null, { status: 201 }));
    expect((await (await s.requete("/api/push/essai", { corps: {}, cookie })).json()).envoyes).toBe(1);
    await s.requete("/api/push/desabonnement", { corps: { endpoint: n.abonnement.endpoint }, cookie });
    expect((await (await s.requete("/api/push", { cookie })).json()).appareils).toEqual([]);
    expect((await s.requete("/api/push")).status).toBe(401);
  });
});

describe("notifications du jour", () => {
  test("le jour où l'alerte commence, puis une fois par semaine ; un pointage qui sort de l'alerte termine la série", async () => {
    const { notificationsDuJour } = await import("../src/data/_notifications");
    const { ajouterJours, aujourdhui } = await import("../src/lib/dates");
    const rpc = async (nom: string, ...args: unknown[]) => (await (await s.rpc(nom, args, cookie)).json()).resultat;
    const jour = aujourdhui();
    const jeanne = await rpc("creerPersonne", { prenom: "Jeanne" });
    const med = await rpc("creerMedicament", { nom: "Kardégic" });
    await rpc("creerTraitement", { personneId: jeanne, medicamentId: med, posologie: { moments: { midi: 4 }, rythme: { type: "quotidien" } }, debut: ajouterJours(jour, -30) });
    const [st] = (await rpc("listeStocks")).filter((x: { medicamentId: string }) => x.medicamentId === med);
    // 20 comprimés ce soir : épuisement dans 21 jours, alerte dans 14 jours (délai 7).
    await rpc("pointer", { stockId: st.id, date: jour, quantite: 20 * 4 });
    expect(await notificationsDuJour(jour)).toEqual([]);
    const debut = ajouterJours(jour, 14);
    const [n] = await notificationsDuJour(debut);
    expect(n).toMatchObject({ titre: "Kardégic : à renouveler", url: `/stocks/${st.id}` });
    expect(n.texte).toContain("Kardégic (Jeanne) : épuisé vers le");
    expect(await notificationsDuJour(ajouterJours(debut, 1))).toEqual([]);
    expect(await notificationsDuJour(ajouterJours(debut, 6))).toEqual([]);
    expect((await notificationsDuJour(ajouterJours(debut, 7))).length).toBe(1);
    // Nouvelles boîtes : on recompte, le stock sort de l'alerte, puis y revient bien plus tard : nouvelle série.
    await rpc("pointer", { stockId: st.id, date: jour, quantite: 200 * 4 });
    expect(await notificationsDuJour(ajouterJours(debut, 8))).toEqual([]);
    await rpc("pointer", { stockId: st.id, date: jour, quantite: 10 * 4 });
    expect((await notificationsDuJour(ajouterJours(debut, 9))).length).toBe(1);
  });
});
