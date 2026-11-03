/** Le logo : une gélule sur fond `marque` (même dessin que public/icone.svg). */
export function Logo({ taille = 28 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="var(--mantine-color-marque-6)" />
      <g transform="rotate(-45 32 32)">
        <rect x="12" y="23" width="40" height="18" rx="9" fill="none" stroke="#fff8f0" strokeWidth="4.5" />
        <path d="M32 23v18" stroke="#fff8f0" strokeWidth="4.5" />
        <path d="M32 25.25h-11a6.75 6.75 0 0 0 0 13.5h11z" fill="#fff8f0" />
      </g>
    </svg>
  );
}
