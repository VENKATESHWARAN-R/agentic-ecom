import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    // Skip build output, deps, and the Python services' virtualenvs (the guard's
    // .venv vendors torch, which ships bundled JS that trips these rules).
    ignores: [".next/**", "node_modules/**", "**/.venv/**"],
  },
];

export default eslintConfig;
