import { createContext, useContext, useState, type ReactNode } from "react";
import { ModalPointage } from "../components/ModalPointage";

/**
 * Saisie rapide, ouverte de n'importe où (bouton « + » du téléphone, accueil) : le pointage d'un stock,
 * éventuellement déjà choisi. null : pas de saisie rapide (le bouton « + » est masqué).
 */
const Saisie = createContext<((stockId?: string) => void) | null>(null);
export const useSaisieRapide = () => useContext(Saisie);

export function FournisseurSaisie({ children }: { children: ReactNode }) {
  const [ouverte, setOuverte] = useState<{ stockId?: string } | null>(null);
  return (
    <Saisie.Provider value={(stockId) => setOuverte({ stockId })}>
      {children}
      <ModalPointage ouvert={!!ouverte} stockId={ouverte?.stockId} onClose={() => setOuverte(null)} />
    </Saisie.Provider>
  );
}
