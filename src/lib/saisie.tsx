import { createContext, useContext, useState, type ReactNode } from "react";
import { ModalPointage, type ModeSaisie } from "../components/ModalPointage";

/**
 * Saisie rapide, ouverte de n'importe où (bouton « + » du téléphone, accueil) : le pointage ou le réapprovisionnement
 * d'un stock, éventuellement déjà choisi. null : pas de saisie rapide (le bouton « + » est masqué).
 */
const Saisie = createContext<((stockId?: string, mode?: ModeSaisie) => void) | null>(null);
export const useSaisieRapide = () => useContext(Saisie);

export function FournisseurSaisie({ children }: { children: ReactNode }) {
  const [ouverte, setOuverte] = useState<{ stockId?: string; mode?: ModeSaisie } | null>(null);
  return (
    <Saisie.Provider value={(stockId, mode) => setOuverte({ stockId, mode })}>
      {children}
      <ModalPointage ouvert={!!ouverte} stockId={ouverte?.stockId} mode={ouverte?.mode} onClose={() => setOuverte(null)} />
    </Saisie.Provider>
  );
}
