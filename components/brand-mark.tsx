interface BrandMarkProps {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 36, className }: BrandMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M20 3C11.7 3 5 9.5 5 17.5C5 27 20 37 20 37S35 27 35 17.5C35 9.5 28.3 3 20 3Z"
        fill="#FF5722"
      />
      <circle cx="20" cy="17" r="10" fill="#FFF9F0" />
      <circle cx="20" cy="17" r="6.5" stroke="#FF5722" strokeWidth="1.6" />
    </svg>
  );
}
