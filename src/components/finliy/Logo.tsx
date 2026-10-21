export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="finliy-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0EA5E9" />
            <stop offset="1" stopColor="#2563EB" />
          </linearGradient>
        </defs>
        <rect width="36" height="36" rx="10" fill="url(#finliy-grad)" />
        <path d="M11 24V12M11 12h6.5a3.5 3.5 0 0 1 0 7H11" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 24l4-5.5M24 24l4-5.5M25.5 18.5h-3M28 18.5h-3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      </svg>
      <span className="text-xl font-bold tracking-tight text-foreground">FINLIY</span>
    </span>
  );
}
