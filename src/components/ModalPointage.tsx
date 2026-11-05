import { useState } from "react";
import { Alert, Button, Group, Modal, SegmentedControl, Select, Stack, Table, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQuery } from "@tanstack/react-query";
import { ajouter, apercuAjout, pointer, stocksAPointer } from "../data/stocks";
import { ChampDate, ChampQuantite } from "./Champs";
import { aujourdhui, dateLisible } from "../lib/dates";
import { quantiteAvecUnite, quantiteLisible } from "../lib/quantites";
import { ecrire } from "../lib/query";

export type ModeSaisie = "pointage" | "ajout";

/**
 * Saisie rapide (bouton « + » du téléphone, fiche d'un stock) : un pointage (on compte ce qui reste, le soir après
 * les prises du jour) ou un réapprovisionnement (on ajoute sans recompter). Plein écran sur téléphone (styles.css).
 */
export function ModalPointage({ ouvert, stockId, mode, onClose }: { ouvert: boolean; stockId?: string; mode?: ModeSaisie; onClose: () => void }) {
  return (
    <Modal opened={ouvert} onClose={onClose} title="Saisie d'un stock">
      {ouvert && <Formulaire stockIdInitial={stockId ?? null} modeInitial={mode ?? "pointage"} onClose={onClose} />}
    </Modal>
  );
}

function Formulaire({ stockIdInitial, modeInitial, onClose }: { stockIdInitial: string | null; modeInitial: ModeSaisie; onClose: () => void }) {
  const { data: stocks } = useQuery({ queryKey: ["stocksAPointer"], queryFn: () => stocksAPointer() });
  const [mode, setMode] = useState<ModeSaisie>(modeInitial);
  const [stockId, setStockId] = useState<string | null>(stockIdInitial);
  const [quantite, setQuantite] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(aujourdhui());
  const [note, setNote] = useState("");
  const s = stocks?.find((x) => x.id === stockId);
  const ajout = mode === "ajout";
  const complet = !!stockId && quantite !== null && !!date && (!ajout || quantite > 0);

  const enregistrer = async (encore: boolean) => {
    if (!stockId || quantite === null || !date) return;
    const r = await ecrire(() => (ajout ? ajouter({ stockId, date, quantite, note }) : pointer({ stockId, date, quantite, note })));
    if (r === undefined) return;
    const q = quantiteAvecUnite(quantite, s?.unite ?? "");
    notifications.show({ color: "green", message: `${s?.libelle} : ${ajout ? `+${q} ajoutés` : `${q} enregistrés`}.` });
    if (encore) {
      setStockId(null);
      setQuantite(null);
      setNote("");
    } else onClose();
  };

  return (
    <Stack>
      <SegmentedControl
        fullWidth
        value={mode}
        onChange={(v) => setMode(v as ModeSaisie)}
        data={[
          { value: "pointage", label: "Pointer" },
          { value: "ajout", label: "Réapprovisionner" },
        ]}
      />
      <Select
        label="Stock"
        placeholder="Médicament…"
        searchable
        data={(stocks ?? []).map((x) => ({ value: x.id, label: x.libelle }))}
        value={stockId}
        onChange={setStockId}
        data-autofocus={!stockIdInitial}
      />
      {s && !ajout && (
        <Text size="sm" c="dimmed">
          {s.estime !== null
            ? `D'après le calcul, il devrait en rester ${quantiteAvecUnite(s.estime, s.unite)} ce soir${s.dernier ? ` (pointé le ${dateLisible(s.dernier)})` : ""}.`
            : "Premier pointage de ce stock."}
        </Text>
      )}
      <ChampQuantite
        label={ajout ? "Ajout" : "Il reste ce soir"}
        description={
          ajout
            ? `En ${s?.unite ?? "unité"}s : ce qui entre dans l'armoire (nouvelles boîtes), sans recompter le reste.`
            : `En ${s?.unite ?? "unité"}s, après les prises du jour, boîtes entamées comprises ; les demis comptent (12,5).`
        }
        valeur={quantite}
        onChange={setQuantite}
        pas={0.5}
        className="champ-quantite"
        data-autofocus={!!stockIdInitial}
      />
      <ChampDate label={ajout ? "Le" : "Le soir du"} required value={date} onChange={setDate} />
      {ajout && stockId && date && <Apercu stockId={stockId} date={date} quantite={quantite ?? 0} unite={s?.unite ?? ""} />}
      <Textarea
        label="Note"
        placeholder={ajout ? "Pharmacie, ordonnance du Dr Martin…" : "Boîte perdue, nouvelle ordonnance…"}
        autosize
        minRows={1}
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
      />
      <Stack gap="xs">
        <Button onClick={() => enregistrer(true)} disabled={!complet}>
          {ajout ? "Ajouter et saisir le suivant" : "Enregistrer et pointer le suivant"}
        </Button>
        <Group grow>
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="light" onClick={() => enregistrer(false)} disabled={!complet}>
            {ajout ? "Ajouter" : "Enregistrer"}
          </Button>
        </Group>
      </Stack>
    </Stack>
  );
}

/** Détail du calcul d'un ajout : départ (pointage ou ajout précédent), prises prévues depuis, ajout, total. */
function Apercu({ stockId, date, quantite, unite }: { stockId: string; date: string; quantite: number; unite: string }) {
  const { data: a } = useQuery({ queryKey: ["apercuAjout", stockId, date, quantite], queryFn: () => apercuAjout({ stockId, date, quantite }) });
  if (!a) return null;
  if (a.sansEffet)
    return (
      <Alert color="orange" p="xs">
        Daté d'avant le dernier pointage ({a.pointage && dateLisible(a.pointage.date)}) : celui-ci compte déjà ces boîtes, l'ajout n'aura pas d'effet.
      </Alert>
    );
  const depuisPointage = !!a.depart && !!a.pointage && a.depart.date === a.pointage.date && a.depart.quantite === a.pointage.quantite;
  return (
    <Table fz="sm" withRowBorders={false} verticalSpacing={2} bg="var(--mantine-color-gray-light)" style={{ borderRadius: 8 }}>
      <Table.Tbody>
        {a.depart ? (
          <>
            <Table.Tr>
              <Table.Td c="dimmed">
                {depuisPointage ? "Compté" : "Calculé après le réapprovisionnement"} le {dateLisible(a.depart.date)}
              </Table.Td>
              <Table.Td ta="right">{quantiteLisible(a.depart.quantite)}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td c="dimmed">Prises prévues depuis</Table.Td>
              <Table.Td ta="right">− {quantiteLisible(a.depart.quantite - (a.prevu ?? 0))}</Table.Td>
            </Table.Tr>
          </>
        ) : (
          <Table.Tr>
            <Table.Td c="dimmed" colSpan={2}>
              Jamais pointé : on part de zéro.
            </Table.Td>
          </Table.Tr>
        )}
        <Table.Tr>
          <Table.Td c="dimmed">Ajout</Table.Td>
          <Table.Td ta="right">+ {quantiteLisible(quantite)}</Table.Td>
        </Table.Tr>
        <Table.Tr fw={600}>
          <Table.Td>Le soir du {dateLisible(date)}</Table.Td>
          <Table.Td ta="right">{a.apres === null ? "—" : quantiteAvecUnite(a.apres, unite)}</Table.Td>
        </Table.Tr>
      </Table.Tbody>
    </Table>
  );
}
