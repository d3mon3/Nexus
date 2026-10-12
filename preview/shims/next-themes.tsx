import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
const Ctx = createContext<{ resolvedTheme: string; theme: string; setTheme: (t: string) => void }>({ resolvedTheme: "dark", theme: "dark", setTheme: () => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(new URLSearchParams(location.search).get("theme") ?? "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.classList.toggle("dark", theme !== "light");
  }, [theme]);
  return <Ctx.Provider value={{ resolvedTheme: theme, theme, setTheme }}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
