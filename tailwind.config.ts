import type { Config } from "tailwindcss";

// darkMode: 'class' — el resto de la app es fixed-dark vía clases hardcodeadas
// (bg-slate-900, etc), no vía prefers-color-scheme. Sin esto, los componentes
// ui/* (que sí usan variantes dark:) quedaban a merced del OS del visitante,
// desincronizados del resto de la app que siempre se ve oscura. Se aplica la
// clase "dark" en <html> desde layout.tsx para que ambos sistemas coincidan.
const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Antes solo se mapeaban background/foreground, y encima sin envolver
        // en hsl(...) — las variables de globals.css son tripletes HSL crudos
        // ("0 0% 100%"), así que `background-color: var(--background)` es CSS
        // inválido y el navegador lo descarta. Resultado: bg-background,
        // text-foreground y TODOS los tokens usados por los componentes
        // ui/* (bg-primary, bg-card, border-input, bg-destructive, etc. —
        // usados en 21+ archivos vía Button/Badge/Card/Avatar/Dialog)
        // nunca generaban ninguna regla CSS real. Verificado contra el CSS
        // compilado: cero coincidencias para .bg-primary/.bg-secondary/etc.
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
export default config;
