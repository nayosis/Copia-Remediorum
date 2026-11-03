/*
 * Notifications Web Push (module du socle), sans service externe ni dépendance : l'application installée sur le
 * téléphone (PWA) s'abonne, le serveur envoie au service de push du navigateur (Apple, Google, Mozilla) un message
 * chiffré.
 *  - VAPID (RFC 8292) : une paire de clés ECDSA P-256 créée au premier lancement, gardée dans comptes.db (réglages) ;
 *    chaque envoi est signé d'un jeton JWT ES256.
 *  - Chiffrement du message (RFC 8291, aes128gcm) : ECDH avec la clé de l'abonnement, HKDF, AES-128-GCM.
 *  - Ce qu'il faut envoyer, et quand, est propre à l'application : `notificationsDuJour` (serveur/modele.ts),
 *    appelé une fois par jour à partir de HEURE_NOTIFICATIONS.
 * Limites : HTTPS obligatoire ; sur iPhone, l'application doit être ajoutée à l'écran d'accueil (iOS 16.4+).
 */
import { baseComptes } from "./comptes";
import { ecrireReglage, lireReglage } from "./reglages";
import { maintenantLocal } from "../src/lib/dates";
import { DEPOT_URL } from "../src/lib/versions";

export const HEURE_NOTIFICATIONS = 9;

export type Notification = { titre: string; texte: string; url?: string; etiquette?: string };
export type Abonnement = { endpoint: string; p256dh: string; auth: string };

// --- base64url

/** Octets sur un ArrayBuffer ordinaire (ce que WebCrypto attend). */
type Octets = Uint8Array<ArrayBuffer>;

export const versB64 = (o: Uint8Array) => Buffer.from(o).toString("base64url");
export const depuisB64 = (s: string): Octets => Uint8Array.from(Buffer.from(s, "base64url"));
const concat = (...parties: Uint8Array[]): Octets => {
  const r = new Uint8Array(parties.reduce((t, p) => t + p.length, 0));
  let i = 0;
  for (const p of parties) {
    r.set(p, i);
    i += p.length;
  }
  return r;
};
const texte = (s: string): Octets => new TextEncoder().encode(s) as Octets;

// --- Clés VAPID

type ClesVapid = { publique: string; privee: JsonWebKey };
let cles: { publique: Octets; privee: CryptoKey } | null = null;

/** Clés VAPID de l'installation (créées au premier appel, puis relues). */
export async function clesVapid() {
  if (cles) return cles;
  const brut = lireReglage("vapid");
  let c: ClesVapid;
  if (brut) c = JSON.parse(brut);
  else {
    const paire = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    c = { publique: versB64(new Uint8Array(await crypto.subtle.exportKey("raw", paire.publicKey))), privee: await crypto.subtle.exportKey("jwk", paire.privateKey) };
    ecrireReglage("vapid", JSON.stringify(c));
  }
  cles = { publique: depuisB64(c.publique), privee: await crypto.subtle.importKey("jwk", c.privee, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]) };
  return cles;
}

/** Clé publique à donner au navigateur (applicationServerKey). */
export const clePublique = async () => versB64((await clesVapid()).publique);

/** En-tête Authorization d'un envoi (RFC 8292) : jeton signé pour l'origine du service de push, 12 h. */
async function autorisation(endpoint: string) {
  const { publique, privee } = await clesVapid();
  const entete = versB64(texte(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corps = versB64(texte(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: DEPOT_URL })));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privee, texte(`${entete}.${corps}`)));
  return `vapid t=${entete}.${corps}.${versB64(signature)}, k=${versB64(publique)}`;
}

// --- Chiffrement (RFC 8291)

async function hkdf(sel: Octets, ikm: Octets, info: Octets, octets: number) {
  const cle = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: sel, info }, cle, octets * 8));
}

/**
 * Chiffre un message pour un abonnement : corps aes128gcm (sel, taille d'enregistrement, clé publique éphémère, texte
 * chiffré). `ephemere` et `sel` ne se passent que dans les tests.
 */
export async function chiffrer(message: Octets, a: Abonnement, ephemere?: CryptoKeyPair, sel: Octets = crypto.getRandomValues(new Uint8Array(16))) {
  const cleUa = depuisB64(a.p256dh);
  const secretAuth = depuisB64(a.auth);
  const paire = ephemere ?? ((await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair);
  const cleAs = new Uint8Array(await crypto.subtle.exportKey("raw", paire.publicKey));
  const ua = await crypto.subtle.importKey("raw", cleUa, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secretEcdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: ua }, paire.privateKey, 256));
  const ikm = await hkdf(secretAuth, secretEcdh, concat(texte("WebPush: info\0"), cleUa, cleAs), 32);
  const cek = await hkdf(sel, ikm, texte("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sel, ikm, texte("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // Un seul enregistrement : le message suivi du délimiteur de dernier enregistrement (0x02).
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(message, new Uint8Array([2]))));
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(sel, rs, new Uint8Array([cleAs.length]), cleAs, chiffre);
}

// --- Abonnements

export function abonner(utilisateurId: string, a: Abonnement & { appareil?: string }) {
  if (!/^https:\/\//.test(a.endpoint) || depuisB64(a.p256dh).length !== 65 || depuisB64(a.auth).length !== 16) throw new Error("Abonnement invalide.");
  baseComptes()
    .query(
      `INSERT INTO abonnement_push (endpoint, utilisateur_id, p256dh, auth, appareil) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (endpoint) DO UPDATE SET utilisateur_id = excluded.utilisateur_id, p256dh = excluded.p256dh, auth = excluded.auth, appareil = excluded.appareil`,
    )
    .run(a.endpoint, utilisateurId, a.p256dh, a.auth, a.appareil?.slice(0, 200) ?? null);
}

export const desabonner = (endpoint: string) => baseComptes().query("DELETE FROM abonnement_push WHERE endpoint = ?").run(endpoint);

export const abonnementsDe = (utilisateurId?: string) =>
  baseComptes()
    .query<Abonnement & { utilisateur_id: string; appareil: string | null }, string[]>(
      `SELECT a.endpoint, a.p256dh, a.auth, a.utilisateur_id, a.appareil FROM abonnement_push a JOIN utilisateur u ON u.id = a.utilisateur_id
       WHERE u.actif = 1 ${utilisateurId ? "AND a.utilisateur_id = ?" : ""}`,
    )
    .all(...(utilisateurId ? [utilisateurId] : []));

/** Envoi effectif (remplaçable dans les tests). */
let transport: (url: string, init: RequestInit) => Promise<Response> = (url, init) => fetch(url, init);
export const definirTransport = (t: typeof transport) => {
  transport = t;
};

/** Envoie une notification à un abonnement ; un abonnement expiré (404, 410) est supprimé. Renvoie le statut HTTP. */
export async function envoyer(a: Abonnement, n: Notification) {
  const corps = await chiffrer(texte(JSON.stringify(n)), a);
  const r = await transport(a.endpoint, {
    method: "POST",
    headers: {
      authorization: await autorisation(a.endpoint),
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
      ttl: String(24 * 3600),
      urgency: "normal",
      ...(n.etiquette ? { topic: n.etiquette.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) } : {}),
    },
    body: corps,
  });
  if (r.status === 404 || r.status === 410) desabonner(a.endpoint);
  else if (!r.ok) console.error(`Notification refusée (${r.status}) par ${new URL(a.endpoint).host} : ${await r.text().catch(() => "")}`);
  return r.status;
}

/** Envoie à tous les appareils abonnés (ou à ceux d'un compte). Renvoie le nombre d'envois acceptés. */
export async function envoyerATous(n: Notification, utilisateurId?: string) {
  let ok = 0;
  for (const a of abonnementsDe(utilisateurId)) {
    try {
      if ((await envoyer(a, n)) < 300) ok++;
    } catch (e) {
      console.error("Notification :", e);
    }
  }
  return ok;
}

// --- Tâche quotidienne

/**
 * Une fois par jour, à partir de HEURE_NOTIFICATIONS (rattrapée au redémarrage) : `quoi(jour)` dit quoi envoyer.
 * Vérifie toutes les 10 minutes, comme la sauvegarde de la nuit.
 */
export function planifierNotifications(quoi: (jour: string) => Promise<Notification[]>) {
  let enCours = false;
  const verifier = async () => {
    const { jour, heure } = maintenantLocal();
    if (enCours || heure < HEURE_NOTIFICATIONS || (lireReglage("notifications_jour") ?? "") >= jour) return;
    enCours = true;
    try {
      ecrireReglage("notifications_jour", jour);
      for (const n of await quoi(jour)) await envoyerATous(n);
    } catch (e) {
      console.error("Notifications du jour :", e);
    } finally {
      enCours = false;
    }
  };
  verifier();
  return setInterval(verifier, 10 * 60 * 1000);
}
