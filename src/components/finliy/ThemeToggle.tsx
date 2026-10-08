import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("finliy:theme");
    const enabled = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", enabled);
    setDark(enabled);
  }, []);
  function toggle() {
    const enabled = !dark;
    document.documentElement.classList.toggle("dark", enabled);
    localStorage.setItem("finliy:theme", enabled ? "dark" : "light");
    setDark(enabled);
  }
  const label = dark ? "Ativar modo claro" : "Ativar modo escuro";
  return <Button type="button" variant="ghost" size="icon" onClick={toggle} aria-label={label} title={label}>
    {dark ? <Sun /> : <Moon />}
  </Button>;
}