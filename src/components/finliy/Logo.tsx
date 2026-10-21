import logoAsset from "@/assets/logo.png.asset.json";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex shrink-0 items-center gap-2 ${className}`}>
      <img
        src={logoAsset.url}
        alt="Logo FINLIY"
        width={40}
        height={40}
        className="h-10 w-auto object-contain"
      />
      <span className="text-2xl font-extrabold">FINLIY</span>
    </div>
  );
}
