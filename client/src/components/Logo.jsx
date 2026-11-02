import { Link } from 'react-router-dom';

export function LogoMark({ size = 40, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="safepath-shield" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B4DF3" />
          <stop offset="0.55" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#D73383" />
        </linearGradient>
      </defs>
      <path
        d="M24 2.5 43 9.2v13.2c0 11.1-7.6 19.9-19 23.1C12.6 42.3 5 33.5 5 22.4V9.2L24 2.5Z"
        fill="url(#safepath-shield)"
      />
      <path
        d="M24 6.4 39.4 11.8v10.6c0 9-6.1 16.3-15.4 19.1-9.3-2.8-15.4-10.1-15.4-19.1V11.8L24 6.4Z"
        stroke="white"
        strokeOpacity="0.45"
        strokeWidth="1.3"
      />
      <path
        d="M24 14.2c-4 0-7.2 3.2-7.2 7.2 0 5.1 7.2 11.4 7.2 11.4s7.2-6.3 7.2-11.4c0-4-3.2-7.2-7.2-7.2Z"
        fill="white"
      />
      <circle cx="24" cy="21.3" r="2.7" fill="#7C3AED" />
    </svg>
  );
}

export default function Logo({ to = '/', size = 40, subtitle = true, compact = false }) {
  return (
    <Link to={to} className="group flex items-center gap-2.5" aria-label="SAFEPATH home">
      <span className="transition-transform duration-300 group-hover:-translate-y-0.5">
        <LogoMark size={size} />
      </span>
      <span className="leading-none">
        <span className="block font-[var(--font-display)] text-lg font-extrabold tracking-tight text-slate-900">
          SAFE<span className="text-brand-600">PATH</span>
        </span>
        {subtitle && !compact ? (
          <span className="mt-1 block text-[10px] font-medium tracking-wide text-slate-500">
            Women Safe Route Navigator
          </span>
        ) : null}
      </span>
    </Link>
  );
}
