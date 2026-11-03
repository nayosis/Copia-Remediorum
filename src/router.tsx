import { Outlet, createRootRoute, createRoute, createRouter, createBrowserHistory, redirect } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Layout } from "./components/Layout";
import { FournisseurSaisie } from "./lib/saisie";
import { SurOrdinateur } from "./components/SurOrdinateur";
import { Accueil } from "./pages/Accueil";
import { FicheNote } from "./pages/FicheNote";
import { Notes } from "./pages/Notes";
import { Sauvegarde } from "./pages/Sauvegarde";
import { Connexion } from "./pages/compte/Connexion";
import { Lien } from "./pages/compte/Lien";
import { Comptes } from "./pages/compte/Comptes";
import { Journal } from "./pages/compte/Journal";
import { estAdmin, utilisateur } from "./lib/session";
import { useEcran } from "./lib/ecran";

/** Pages trop denses pour un téléphone : on y invite à passer sur ordinateur ou tablette. */
const surOrdinateur = (Page: () => ReactNode, titre: string) =>
  function PageSurOrdinateur() {
    return useEcran().telephone ? <SurOrdinateur titre={titre} /> : <Page />;
  };

const racine = createRootRoute({ component: Outlet });

/** Pages publiques : connexion, choix du mot de passe par lien. */
export const connexionRoute = createRoute({
  getParentRoute: () => racine,
  path: "/connexion",
  component: Connexion,
  validateSearch: (s: Record<string, unknown>): { retour?: string; email?: string } => ({
    ...(typeof s.retour === "string" ? { retour: s.retour } : {}),
    ...(typeof s.email === "string" ? { email: s.email } : {}),
  }),
});
export const lienRoute = createRoute({ getParentRoute: () => racine, path: "/lien/$jeton", component: Lien });

/** Tout le reste demande d'être connecté. */
const application = createRoute({
  getParentRoute: () => racine,
  id: "application",
  component: () => (
    <FournisseurSaisie>
      <Layout />
    </FournisseurSaisie>
  ),
  beforeLoad: ({ location }) => {
    if (!utilisateur()) throw redirect({ to: "/connexion", search: { retour: location.href } });
  },
});
const reserveAdmin = () => {
  if (!estAdmin()) throw redirect({ to: "/" });
};

export const accueilRoute = createRoute({ getParentRoute: () => application, path: "/", component: Accueil });
// --- Pages de l'application (EXEMPLE : les notes)
export const notesRoute = createRoute({
  getParentRoute: () => application,
  path: "/notes",
  component: Notes,
  // Filtres dans l'adresse : partageables, et conservés au retour arrière.
  validateSearch: (s: Record<string, unknown>): { q?: string; archivees?: boolean } => ({
    ...(typeof s.q === "string" && s.q ? { q: s.q } : {}),
    ...(s.archivees === true || s.archivees === "true" ? { archivees: true } : {}),
  }),
});
export const ficheNoteRoute = createRoute({ getParentRoute: () => application, path: "/notes/$id", component: FicheNote });

// --- Pages du socle (admins, sur ordinateur)
const sauvegarde = createRoute({ getParentRoute: () => application, path: "/sauvegarde", component: surOrdinateur(Sauvegarde, "Sauvegarde"), beforeLoad: reserveAdmin });
const comptes = createRoute({ getParentRoute: () => application, path: "/comptes", component: surOrdinateur(Comptes, "Comptes"), beforeLoad: reserveAdmin });
const journal = createRoute({ getParentRoute: () => application, path: "/journal", component: surOrdinateur(Journal, "Journal"), beforeLoad: reserveAdmin });

export const router = createRouter({
  routeTree: racine.addChildren([connexionRoute, lienRoute, application.addChildren([accueilRoute, notesRoute, ficheNoteRoute, sauvegarde, comptes, journal])]),
  history: createBrowserHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
