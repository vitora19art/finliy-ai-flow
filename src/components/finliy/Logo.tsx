import logoAsset from "@/assets/logo.png.asset.json";

export function Logo({ className = "", src = logoAsset.url }: { className?: string; src?: string }) {
  return (
    <div className={`flex shrink-0 items-center gap-2 ${className}`}>
      <img src={src} alt="Logo FINLIY" width={44} height={44} className="size-11 shrink-0 object-contain" />
      <span className="text-2xl font-extrabold">FINLIY</span>
    </div>
  );
}