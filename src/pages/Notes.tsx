import { Badge, Button, Group, SegmentedControl, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconPaperclip, IconPlus, IconSearch } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { listeNotes } from "../data/notes";
import { dateLisible } from "../lib/dates";
import { useEcran } from "../lib/ecran";
import { useNouvelleNote } from "../lib/saisie";
import { peutEcrire } from "../lib/session";
import { notesRoute } from "../router";

/** EXEMPLE — liste filtrée ; les filtres sont dans l'adresse (?q=…&archivees=true), donc partageables. */
export function Notes() {
  const { telephone } = useEcran();
  const naviguer = useNavigate({ from: "/notes" });
  const nouvelle = useNouvelleNote();
  const { q, archivees } = notesRoute.useSearch();
  const [saisie, setSaisie] = useState(q ?? "");
  const [recherche] = useDebouncedValue(saisie, 250);
  useEffect(() => {
    if ((recherche || undefined) !== q) naviguer({ search: (s) => ({ ...s, q: recherche || undefined }), replace: true });
  }, [recherche]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: notes } = useQuery({ queryKey: ["notes", q, !!archivees], queryFn: () => listeNotes({ recherche: q, archivees }) });

  return (
    <Stack p={telephone ? "md" : "xl"} gap="md" maw={1000}>
      <Group justify="space-between">
        <Title order={2}>Notes</Title>
        {peutEcrire() && !telephone && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => nouvelle()}>
            Nouvelle note
          </Button>
        )}
      </Group>
      <Group>
        <TextInput leftSection={<IconSearch size={16} />} placeholder="Rechercher" value={saisie} onChange={(e) => setSaisie(e.currentTarget.value)} style={{ flex: 1 }} />
        <SegmentedControl
          value={archivees ? "archivees" : "actives"}
          onChange={(v) => naviguer({ search: (s) => ({ ...s, archivees: v === "archivees" || undefined }) })}
          data={[
            { value: "actives", label: "Actives" },
            { value: "archivees", label: "Archivées" },
          ]}
        />
      </Group>
      {notes?.length === 0 ? (
        <Text c="dimmed">Aucune note.</Text>
      ) : (
        <Table highlightOnHover>
          <Table.Tbody>
            {notes?.map((n) => (
              <Table.Tr key={n.id} className="ligne-cliquable" onClick={() => naviguer({ to: "/notes/$id", params: { id: n.id } })}>
                <Table.Td>
                  <Text fw={500}>{n.titre}</Text>
                  {n.texte && (
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {n.texte}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td w={60}>
                  {n.nbPieces > 0 && (
                    <Badge variant="light" leftSection={<IconPaperclip size={12} />}>
                      {n.nbPieces}
                    </Badge>
                  )}
                </Table.Td>
                {!telephone && (
                  <Table.Td w={160} c="dimmed" ta="right">
                    {n.modifieLe ? dateLisible(n.modifieLe.slice(0, 10)) : ""}
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
