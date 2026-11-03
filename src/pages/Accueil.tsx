import { Button, Card, Group, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconAdjustmentsHorizontal, IconPill } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listePersonnes } from "../data/referentiel";
import { AvisMiseAJour } from "../components/MiseAJour";
import { useEcran } from "../lib/ecran";
import { peutEcrire } from "../lib/session";

/** « Mardi 27 octobre 2026 ». */
export function aujourdhuiLong() {
  const t = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Premier lancement : rien n'est encore saisi. */
export function Bienvenue() {
  const { telephone } = useEcran();
  return (
    <Card withBorder padding="lg">
      <Group align="flex-start" wrap="nowrap">
        <ThemeIcon size={44} radius="md" variant="light">
          <IconPill size={26} />
        </ThemeIcon>
        <Stack gap={4}>
          <Text fw={600}>Bienvenue dans Copia Remediorum</Text>
          <Text size="sm" c="dimmed">
            Pour commencer : ajoutez les personnes suivies dans les Paramètres, puis leurs traitements avec la posologie. Il suffira ensuite de compter
            les boîtes de temps en temps : l'application dira quand demander l'ordonnance.
          </Text>
          {peutEcrire() && !telephone && (
            <Button component={Link} to="/parametres" mt="sm" leftSection={<IconAdjustmentsHorizontal size={16} />} w="fit-content">
              Ouvrir les paramètres
            </Button>
          )}
        </Stack>
      </Group>
    </Card>
  );
}

/** Accueil (remplacé par « À renouveler » à l'étape 4). */
export function Accueil() {
  const { telephone } = useEcran();
  const { data: personnes } = useQuery({ queryKey: ["personnes", false], queryFn: () => listePersonnes() });
  return (
    <Stack p={telephone ? "md" : "xl"} gap="lg" maw={1100}>
      <AvisMiseAJour />
      <div>
        <Title order={2}>Accueil</Title>
        <Text c="dimmed" size="sm">
          {aujourdhuiLong()}
        </Text>
      </div>
      {personnes?.length === 0 && <Bienvenue />}
    </Stack>
  );
}
