import { createContext, useContext, type ReactNode } from "react";

/**
 * Saisie rapide, ouverte de n'importe où (bouton « + » du téléphone, accueil) : l'objet que l'application saisit le
 * plus souvent. null : pas de saisie rapide (le bouton « + » est masqué).
 */
const Saisie = createContext<(() => void) | null>(null);
export const useSaisieRapide = () => useContext(Saisie);

export function FournisseurSaisie({ children }: { children: ReactNode }) {
  return <Saisie.Provider value={null}>{children}</Saisie.Provider>;
}
