/*
 * Service worker : affiche les notifications envoyées par le serveur (serveur/push.ts) et ouvre la page concernée
 * au toucher. Il ne met rien en cache : l'application ne fonctionne pas hors ligne (décision de la V1).
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let n;
  try {
    n = e.data.json();
  } catch {
    n = { titre: "Notification", texte: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    self.registration.showNotification(n.titre, {
      body: n.texte,
      icon: "/icone-192.png",
      badge: "/icone-192.png",
      tag: n.etiquette,
      renotify: !!n.etiquette,
      data: { url: n.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      const ouverte = fenetres.find((f) => f.url.startsWith(self.location.origin));
      if (ouverte) return ouverte.navigate(url).then((f) => (f || ouverte).focus());
      return self.clients.openWindow(url);
    }),
  );
});
