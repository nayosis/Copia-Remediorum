import { createContext, useContext, useState, type ReactNode } from "react";
import { ModalNote } from "../components/ModalNote";

/**
 * Saisie rapide, ouverte de n'importe où (bouton « + » du téléphone, accueil, liste) : le modèle à suivre pour
 * l'objet que l'application saisit le plus souvent. EXEMPLE : une note.
 */
const Saisie = createContext<() => void>(() => {});
export const useNouvelleNote = () => useContext(Saisie);

export function FournisseurSaisie({ children }: { children: ReactNode }) {
  const [ouverte, setOuverte] = useState(false);
  return (
    <Saisie.Provider value={() => setOuverte(true)}>
      {children}
      <ModalNote opened={ouverte} onClose={() => setOuverte(false)} />
    </Saisie.Provider>
  );
}
