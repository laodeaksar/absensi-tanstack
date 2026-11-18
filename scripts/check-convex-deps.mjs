// Menjaga aturan dependensi antar modul Convex.
// Jalankan: node scripts/check-convex-deps.mjs
// Setiap modul baru WAJIB didaftarkan di ALLOWED, sehingga ketergantungannya diputuskan dengan sadar.
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const DIR = "convex";

// "*" = modul infrastruktur atau skrip operasional, boleh mengimpor apa saja.
const ALLOWED = {
  // Lapisan dasar: tidak boleh mengimpor lib (mencegah siklus)
  errors: [],
  rules: [],
  limits: ["rules"],
  security: ["errors", "rules"],
  access: ["errors", "security"],
  lib: ["errors", "security", "access", "rules", "limits"],

  // Konfigurasi dan akun
  settings: ["lib", "access", "rules", "limits", "errors"],
  auth: [
    "lib",
    "security",
    "access",
    "errors",
    "rules",
    "limits",
    "settings",
    "jwt",
    "auth_config",
  ],

  // Domain
  master: [
    "lib",
    "access",
    "security",
    "settings",
    "rules",
    "limits",
    "errors",
  ],
  subjects: ["lib", "access", "rules", "limits", "errors"],
  attendance: ["lib", "access", "settings", "rules", "limits", "errors"],
  grades: ["lib", "access", "settings", "rules", "limits", "errors"],
  "assignment.core": ["lib", "rules", "limits", "errors"],
  assignment: ["assignment.core", "lib", "access", "rules", "limits", "errors"],
  submission: ["assignment.core", "lib", "access", "rules", "limits", "errors"],

  // Lapisan orkestrasi dan baca: boleh membaca domain lain, tidak boleh diimpor siapa pun
  promotion: [
    "master",
    "grades",
    "lib",
    "access",
    "settings",
    "rules",
    "limits",
    "errors",
  ],
  reports: [
    "master",
    "attendance",
    "grades",
    "lib",
    "access",
    "settings",
    "rules",
    "limits",
    "errors",
  ],

  // Infrastruktur dan skrip operasional
  schema: "*",
  http: "*",
  jwt: "*",
  "auth.config": "*",
  crons: "*",
  maintenance: "*",
  seed: "*",
  debug: "*",
};

const files = readdirSync(DIR).filter(
  (f) => f.endsWith(".ts") && !f.endsWith(".d.ts"),
);

const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const graph = new Map();
const errors = [];

for (const file of files) {
  const name = basename(file, ".ts");
  const src = stripComments(readFileSync(join(DIR, file), "utf8"));
  const deps = new Set();
  for (const m of src.matchAll(/\bfrom\s+["']\.\/([\w-]+)["']/g))
    deps.add(m[1]);
  graph.set(name, deps);

  const rule = ALLOWED[name];
  if (rule === undefined) {
    errors.push(
      `${name}.ts belum terdaftar di ALLOWED (scripts/check-convex-deps.mjs).`,
    );
    continue;
  }
  if (rule === "*") continue;
  for (const dep of deps)
    if (dep !== "_generated" && !rule.includes(dep))
      errors.push(`${name}.ts tidak boleh mengimpor ${dep}.ts`);
}

// Deteksi siklus pada graf impor sebenarnya
const state = new Map(); // 1 = sedang ditelusuri, 2 = selesai
const stack = [];
function visit(n) {
  if (state.get(n) === 2) return;
  if (state.get(n) === 1) {
    errors.push(
      `Siklus impor: ${[...stack.slice(stack.indexOf(n)), n].join(" -> ")}`,
    );
    return;
  }
  state.set(n, 1);
  stack.push(n);
  for (const d of graph.get(n) ?? []) if (graph.has(d)) visit(d);
  stack.pop();
  state.set(n, 2);
}
for (const n of graph.keys()) visit(n);

if (errors.length) {
  console.error(
    "Pelanggaran aturan dependensi Convex:\n- " +
      [...new Set(errors)].join("\n- "),
  );
  process.exit(1);
}
console.log(`Dependensi Convex OK (${graph.size} modul).`);
