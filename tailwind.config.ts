import type { Config } from "tailwindcss";

// Every colour comes from the CSS variables in src/app/globals.css (the design tokens).
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: token("primary"),
          deep: token("primary-deep"),
          secondary: token("primary-secondary"),
          mint: token("mint"),
          pale: token("pale"),
        },
        surface: token("surface"),
        ink: token("ink"),
        muted: token("muted"),
        line: token("line"),
        success: token("success"),
        warning: token("warning"),
        "warning-text": token("warning-text"),
        danger: token("danger"),
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      borderRadius: { DEFAULT: "6px", md: "8px", lg: "10px" },
      maxWidth: { page: "72rem" },
    },
  },
  plugins: [],
};

export default config;
