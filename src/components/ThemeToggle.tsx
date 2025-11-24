import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="relative bg-black/5 border-black/10 text-gray-900 hover:bg-black/10 dark:bg-white/10 dark:border-white/20 dark:text-white dark:hover:bg-white/20 transition-colors"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Sun className={`h-4 w-4 transition-all ${isDark ? "opacity-0 scale-75" : "opacity-100 scale-100"}`} />
      <Moon className={`absolute h-4 w-4 transition-all ${isDark ? "opacity-100 scale-100" : "opacity-0 scale-75"}`} />
    </Button>
  );
};

export default ThemeToggle;

