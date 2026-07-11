import Link from 'next/link';

interface BrandMarkProps {
  readonly linked?: boolean;
}

export function BrandMark({ linked = true }: BrandMarkProps): React.ReactElement {
  const content = (
    <span className="brand-mark" aria-label="Health Compass">
      <span className="brand-icon" aria-hidden="true">
        <svg viewBox="0 0 32 32" role="img">
          <path d="M16 3.5c6.9 0 12.5 5.6 12.5 12.5S22.9 28.5 16 28.5 3.5 22.9 3.5 16 9.1 3.5 16 3.5Z" />
          <path d="m19.6 12.4-2 5.2-5.2 2 2-5.2 5.2-2Z" className="brand-icon-needle" />
        </svg>
      </span>
      <span>Health Compass</span>
    </span>
  );

  return linked ? <Link href="/">{content}</Link> : content;
}
