import { useEffect, useState } from "react";
import { Alert, Button, Group, List, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBell, IconBellOff, IconInfoCircle } from "@tabler/icons-react";
import { appelApi } from "../lib/rpc";

/*
 * Notifications sur cet appareil (Web Push, serveur/push.ts) : chaque compte active les siennes, appareil par appareil.
 * Le service worker (public/sw.js) les affiche.
 */

const prisEnCharge = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const iPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const installee = () => matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Inscrit le service worker (au démarrage) : sans lui, pas de notification. Rien hors HTTPS (sauf localhost). */
export function inscrireServiceWorker() {
  if (!prisEnCharge() || !window.isSecureContext) return;
  navigator.serviceWorker.register("/sw.js").catch((e) => console.error("Service worker :", e));
}

/** « iPhone · Safari », « Android · Chrome »… pour reconnaître ses appareils. */
function nomAppareil() {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Linux";
  const nav = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : "Safari";
  return `${os} · ${nav}`;
}

export function ModalNotifications({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [abonne, setAbonne] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "inconnue">("inconnue");
  const [occupe, setOccupe] = useState(false);
  const possible = prisEnCharge() && window.isSecureContext;

  useEffect(() => {
    if (!opened || !possible) return;
    setPermission(Notification.permission);
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then(setAbonne);
  }, [opened, possible]);

  const activer = async () => {
    setOccupe(true);
    try {
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p !== "granted") return;
      const { cle } = await appelApi<{ cle: string }>("/api/push");
      const reg = await navigator.serviceWorker.ready;
      const cleServeur = Uint8Array.from(atob(cle.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      // Le service de push du navigateur (Apple, Google, Mozilla) peut ne pas répondre : on ne reste pas bloqué.
      const sub = await Promise.race([
        reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleServeur }),
        new Promise<never>((_, refus) => setTimeout(() => refus(new Error("Le service de notifications du navigateur ne répond pas : réessayez plus tard.")), 20_000)),
      ]);
      const json = sub.toJSON();
      await appelApi("/api/push/abonnement", { corps: { endpoint: sub.endpoint, keys: json.keys, appareil: nomAppareil() } });
      setAbonne(sub);
      await appelApi("/api/push/essai", { corps: {} });
    } catch (e) {
      notifications.show({ color: "red", title: "Notifications", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setOccupe(false);
    }
  };

  const desactiver = async () => {
    if (!abonne) return;
    setOccupe(true);
    try {
      await appelApi("/api/push/desabonnement", { corps: { endpoint: abonne.endpoint } });
      await abonne.unsubscribe();
      setAbonne(null);
    } finally {
      setOccupe(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Notifications sur cet appareil">
      <Stack>
        {!possible ? (
          <Alert color="orange" icon={<IconInfoCircle size={18} />}>
            {iPhone() && !installee() ? (
              <>
                Sur iPhone et iPad, les notifications demandent d'installer l'application :
                <List size="sm" mt={4}>
                  <List.Item>dans Safari, bouton Partager, puis « Sur l'écran d'accueil » ;</List.Item>
                  <List.Item>ouvrez l'application depuis sa nouvelle icône, et revenez ici.</List.Item>
                </List>
              </>
            ) : !window.isSecureContext ? (
              "Les notifications demandent une adresse sécurisée (https://)."
            ) : (
              "Ce navigateur ne permet pas les notifications."
            )}
          </Alert>
        ) : permission === "denied" ? (
          <Alert color="orange" icon={<IconInfoCircle size={18} />}>
            Les notifications sont bloquées pour ce site : autorisez-les dans les réglages du navigateur (ou du téléphone), puis revenez ici.
          </Alert>
        ) : (
          <>
            <Text size="sm">
              {abonne
                ? "Activées : cet appareil est prévenu quand un médicament entre dans son délai d'alerte, puis une fois par semaine tant qu'il n'est pas renouvelé."
                : "Être prévenu sur cet appareil quand un médicament est à renouveler (le jour où l'alerte commence, puis une fois par semaine)."}
            </Text>
            <Group>
              {abonne ? (
                <>
                  <Button variant="default" leftSection={<IconBellOff size={16} />} loading={occupe} onClick={desactiver}>
                    Désactiver
                  </Button>
                  <Button variant="light" onClick={() => appelApi("/api/push/essai", { corps: {} })}>
                    Envoyer un essai
                  </Button>
                </>
              ) : (
                <Button leftSection={<IconBell size={16} />} loading={occupe} onClick={activer}>
                  Activer
                </Button>
              )}
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
