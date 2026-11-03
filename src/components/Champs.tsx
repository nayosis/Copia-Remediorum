import { NumberInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { lireDate } from "../lib/dates";

/** Champ date français, effaçable ; se saisit aussi au clavier (« 14/03/2025 »). */
export function ChampDate(props: {
  label: string;
  description?: string;
  value: string | null;
  onChange: (v: string | null) => void;
  required?: boolean;
  clearable?: boolean;
  minDate?: string;
  "data-autofocus"?: boolean;
}) {
  const { clearable = !props.required, ...reste } = props;
  return <DateInput {...reste} valueFormat="DD/MM/YYYY" placeholder="jj/mm/aaaa" dateParser={lireDate} clearable={clearable} />;
}

/** Quantité par quart d'unité (« 1,5 », « 0,25 ») ; `valeur` et `onChange` en quarts. */
export function ChampQuantite(props: {
  label?: string;
  description?: string;
  valeur: number | null;
  onChange: (quarts: number | null) => void;
  /** Pas de saisie : 0,25 (posologie) ou 0,5 (pointage). */
  pas?: number;
  placeholder?: string;
  w?: number | string;
  "data-autofocus"?: boolean;
  className?: string;
}) {
  const { valeur, onChange, pas = 0.25, ...reste } = props;
  return (
    <NumberInput
      {...reste}
      min={0}
      step={pas}
      decimalScale={2}
      decimalSeparator=","
      allowNegative={false}
      value={valeur === null ? "" : valeur / 4}
      onChange={(v) => onChange(v === "" ? null : Math.round(Number(v) * 4))}
    />
  );
}
