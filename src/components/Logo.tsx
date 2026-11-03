/** Le logo : trois assises de pierre sur fond `marque` (même dessin que public/icone.svg). À redessiner par application. */
export function Logo({ taille = 28 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="var(--mantine-color-marque-6)" />
      <g fill="#fff8f0">
        <rect x="24" y="16" width="16" height="8" rx="2" />
        <rect x="17" y="28" width="30" height="8" rx="2" />
        <rect x="10" y="40" width="44" height="8" rx="2" />
      </g>
    </svg>
  );
}
