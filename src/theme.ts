import { createTheme, type MantineColorsTuple } from "@mantine/core";

/*
 * Patte graphique. Chaque application choisit sa couleur `marque` (action, logo, liens actifs) pour ne pas être
 * confondue avec les autres (Custos Domus : terre cuite, Cura Parentum : prune, Copia Remediorum : vert sauge) ; fonds crème et gris chauds communs.
 * Changer la couleur : remplacer les 10 nuances ci-dessous (outil : https://mantine.dev/colors-generator/),
 * et la couleur de public/icone.svg (puis bun scripts/icones.ts).
 */
const marque: MantineColorsTuple = ["#edf6f2", "#d9ebe3", "#b0d6c6", "#85c0a7", "#62ad8d", "#4c9f7c", "#3f8a6a", "#33735a", "#285c48", "#1b4434"];

/** Gris chauds (mode sombre) : du sable clair au brun presque noir. */
const dark: MantineColorsTuple = ["#e0d9d2", "#c4bab0", "#9c9187", "#776d64", "#544b44", "#3f3832", "#2f2a26", "#25211e", "#1d1a17", "#151311"];

export const theme = createTheme({
  primaryColor: "marque",
  primaryShade: { light: 6, dark: 4 },
  colors: { marque, dark },
  defaultRadius: "md",
  fontFamily: "Inter, Segoe UI, system-ui, sans-serif",
  headings: { fontFamily: "Georgia, Cambria, 'Times New Roman', serif", fontWeight: "600" },
});
