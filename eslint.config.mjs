import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const DB_LAW =
  "Database access lives in src/lib/db — use its accessor functions instead.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The API-boundary and data-access laws, above the routes:
  // 1. Every JSON response must be serialized through json(schema, …)
  //    from src/lib/http.ts so the schema allowlist runs (secrets are
  //    stripped, unknown keys rejected). Raw Response.json /
  //    NextResponse.json calls are banned — this is what keeps FUTURE
  //    endpoints on the gate. The gate itself is the one sanctioned
  //    exception (see the eslint-disable in src/lib/http.ts).
  // 2. Lazy zod schemas (any/unknown/passthrough/…) defeat the
  //    allowlist and are banned as antipatterns.
  // 3. Outside src/lib/db, nothing may touch the database handle,
  //    its schema, or the driver — only the accessor modules may.
  //    (Type-only imports are fine; accessor modules like
  //    @/lib/db/webhooks are the sanctioned API.)
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/db/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name=/^(Response|NextResponse)$/][callee.property.name='json']",
          message:
            "Return API responses through json(schema, …) from @/lib/http.",
        },
        {
          selector:
            "CallExpression[callee.object.name='z'][callee.property.name=/^(any|unknown|looseObject)$/]",
          message:
            "Lazy zod schemas defeat the response allowlist — model the exact shape.",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(passthrough|catchall)$/]",
          message:
            "Lazy zod schemas defeat the response allowlist — model the exact shape.",
        },
        {
          selector:
            ":matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration)[source.value=/(^|\\/)lib\\/db(\\/index|\\/schema)?$/]:not([importKind='type'])",
          message: DB_LAW,
        },
        {
          selector:
            ":matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration)[source.value=/^\\.{1,2}\\/db(\\/index|\\/schema)?$/]:not([importKind='type'])",
          message: DB_LAW,
        },
        {
          selector:
            ":matches(ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration)[source.value=/^(drizzle-orm(\\/.*)?|better-sqlite3)$/]:not([importKind='type'])",
          message: DB_LAW,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
