import logoAsset from "@/assets/logo.png.asset.json";

export function Logo({ className = "" }: { className?: string }) {
  return <img src={logoAsset.url} alt="FINLIY" className={`h-8 w-auto object-contain ${className}`} />;
}
