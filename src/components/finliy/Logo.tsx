import lightLogo from "@/assets/logo-light.svg";
import darkLogo from "@/assets/logo-dark.svg";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex shrink-0 items-center gap-2 ${className}`}>
      <img src={lightLogo} alt="Logo FINLIY" width={44} height={44} className="size-11 shrink-0 object-contain dark:hidden" />
      <img src={darkLogo} alt="Logo FINLIY" width={44} height={44} className="hidden size-11 shrink-0 object-contain dark:block" />
      <span className="text-2xl font-extrabold">FINLIY</span>
    </div>
  );
}
