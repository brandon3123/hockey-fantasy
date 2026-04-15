import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "hot-streak": "#22c55e",
        "cold-streak": "#ef4444",
        "team-stack": "#3b82f6",
      },
    },
  },
  plugins: [],
};
export default config;
