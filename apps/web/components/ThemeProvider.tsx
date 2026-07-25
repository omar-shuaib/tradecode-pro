"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className="inline-flex items-center justify-center w-9 h-9 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors duration-200"
        aria-label="Toggle theme"
      >
        <Monitor className="w-4 h-4" />
      </button>
    );
  }

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const icon = () => {
    if (theme === "light") {
      return <Sun className="w-4 h-4" />;
    }
    if (theme === "dark") {
      return <Moon className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
  };

  return (
    <button
      onClick={cycleTheme}
      className="inline-flex items-center justify-center w-9 h-9 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text)] transition-all duration-200 ease-out"
      aria-label={`Current theme: ${theme}. Click to cycle.`}
    >
      <span className="transition-transform duration-300 ease-out hover:rotate-12">
        {icon()}
      </span>
    </button>
  );
}
