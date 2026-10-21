export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="40" height="40" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M19.5 7H35a5 5 0 0 1 5 5v3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M18.5 10.5H36a5 5 0 0 1 5 5V36a5 5 0 0 1-5 5H20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M34.5 21.5h7a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-7a4.5 4.5 0 0 1 0-9Z" fill="currentColor" />
        <circle cx="35" cy="26" r="1.5" fill="var(--background)" />
        <path d="M21 7.5C12.8 10.4 7 18.2 7 27.2c0 9.2 6.2 17.2 15 19.8l-2.4-6.8c-4.9-2.2-8.3-7.1-8.3-12.9 0-5.7 3.3-10.6 8.1-12.8L21 7.5Z" fill="#00BF63" />
        <path d="M21 7.5 17.2 7l3.1 3.2 3.7 3.8V8.4L21 7.5Z" fill="#00BF63" />
      </svg>
      <span className="text-xl font-bold tracking-tight text-foreground">FINLIY</span>
    </span>
  );
}
