import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const critical = [
  "index.html",
  "portal-core-v1141.js",
  "firebase-service.js",
  "territory-experience.js",
  "territory-map-engine.js",
  "claude-design.js",
  "claude-design.css",
  "motion-studio.js",
  "inline-admin.js",
  "admin-popup.js",
  "san-pedro-connected.js",
  "san-pedro-connected.css",
  "ui-gifs/cat-hello.gif",
  "ui-gifs/click-effect.gif",
  "hero-gifs/chiva.gif"
];

const failures = [];
for (const relative of critical) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full) || fs.statSync(full).size === 0) {
    failures.push(`Falta o está vacío: ${relative}`);
  }
}

const core = fs.readFileSync(path.join(root, "portal-core-v1141.js"), "utf8");
for (const required of ["territory-experience.js", "firebase-service.js", "claude-design.js", "motion-studio.js"]) {
  if (!core.includes(required)) failures.push(`El núcleo activo ya no carga: ${required}`);
}

for (const name of fs.readdirSync(root).filter(name => name.endsWith(".js"))) {
  const source = fs.readFileSync(path.join(root, name), "utf8");
  try {
    new vm.Script(source, { filename: name });
  } catch (error) {
    failures.push(`Error sintáctico en ${name}: ${error.message}`);
  }
}

if (failures.length) {
  console.error("VERIFICACIÓN FALLIDA");
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`VERIFICACIÓN CORRECTA: ${critical.length} módulos críticos presentes y JavaScript válido.`);
