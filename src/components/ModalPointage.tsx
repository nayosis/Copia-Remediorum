import { useState } from "react";
import { Button, Group, Modal, Select, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQuery } from "@tanstack/react-query";
import { pointer, stocksAPointer } from "../data/stocks";
import { ChampDate, ChampQuantite } from "./Champs";
import { aujourdhui, dateLisible } from "../lib/dates";
import { quantiteAvecUnite } from "../lib/quantites";
import { ecrire } from "../lib/query";

/**
 * Saisie rapide d'un pointage (bouton « + » du téléphone, fiche d'un stock) : on compte ce qui reste, le soir après
 * les prises du jour. Plein écran sur téléphone (styles.css).
 */
export function ModalPointage({ ouvert, stockId, onClose }: { ouvert: boolean; stockId?: string; onClose: () => void }) {
  return (
    <Modal opened={ouvert} onClose={onClose} title="Pointer un stock">
      {ouvert && <Formulaire stockIdInitial={stockId ?? null} onClose={onClose} />}
    </Modal>
  );
}

function Formulaire({ stockIdInitial, onClose }: { stockIdInitial: string | null; onClose: () => void }) {
  const { data: stocks } = useQuery({ queryKey: ["stocksAPointer"], queryFn: () => stocksAPointer() });
  const [stockId, setStockId] = useState<string | null>(stockIdInitial);
  const [quantite, setQuantite] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(aujourdhui());
  const [note, setNote] = useState("");
  const s = stocks?.find((x) => x.id === stockId);

  const enregistrer = async (encore: boolean) => {
    if (!stockId || quantite === null || !date) return;
    const r = await ecrire(() => pointer({ stockId, date, quantite, note }));
    if (r === undefined) return;
    notifications.show({ color: "green", message: `${s?.libelle} : ${quantiteAvecUnite(quantite, s?.unite ?? "")} enregistrés.` });
    if (encore) {
      setStockId(null);
      setQuantite(null);
      setNote("");
    } else onClose();
  };

  return (
    <Stack>
      <Select
        label="Stock"
        placeholder="Médicament…"
        searchable
        data={(stocks ?? []).map((x) => ({ value: x.id, label: x.libelle }))}
        value={stockId}
        onChange={setStockId}
        data-autofocus={!stockIdInitial}
      />
      {s && (
        <Text size="sm" c="dimmed">
          {s.estime !== null
            ? `D'après le calcul, il devrait en rester ${quantiteAvecUnite(s.estime, s.unite)} ce soir (pointé le ${dateLisible(s.dernier)}).`
            : "Premier pointage de ce stock."}
        </Text>
      )}
      <ChampQuantite
        label="Il reste ce soir"
        description={`En ${s?.unite ?? "unité"}s, après les prises du jour, boîtes entamées comprises ; les demis comptent (12,5).`}
        valeur={quantite}
        onChange={setQuantite}
        pas={0.5}
        className="champ-quantite"
        data-autofocus={!!stockIdInitial}
      />
      <ChampDate label="Le soir du" required value={date} onChange={setDate} />
      <Textarea label="Note" placeholder="Boîte perdue, nouvelle ordonnance…" autosize minRows={1} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      <Stack gap="xs">
        <Button onClick={() => enregistrer(true)} disabled={!stockId || quantite === null || !date}>
          Enregistrer et pointer le suivant
        </Button>
        <Group grow>
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="light" onClick={() => enregistrer(false)} disabled={!stockId || quantite === null || !date}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </Stack>
  );
}
