import logoAsset from "@/assets/logo.png.asset.json";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Logo FINLIY"
      width={40}
      height={40}
      className={`h-10 w-auto object-contain ${className}`}
    />
  );
}
