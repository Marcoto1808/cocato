#!/usr/bin/env node
/**
 * Asegura que Puppeteer tenga un navegador disponible tras npm install.
 * Si ya hay Chrome bundled o instalado en el sistema (Windows), no descarga nada.
 */
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const RUTAS_CHROME_WINDOWS = [
  `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

function chromeDelSistema() {
  if (process.platform !== "win32") return undefined;
  return RUTAS_CHROME_WINDOWS.find((ruta) => ruta && existsSync(ruta));
}

async function main() {
  try {
    const puppeteer = await import("puppeteer");
    const bundled = puppeteer.default.executablePath();
    if (bundled && existsSync(bundled)) {
      console.log("[puppeteer] Chrome bundled disponible.");
      return;
    }
  } catch {
    // Continuar con instalación o Chrome del sistema.
  }

  const sistema = chromeDelSistema();
  if (sistema) {
    console.log("[puppeteer] Chrome del sistema detectado; omitiendo descarga.");
    return;
  }

  console.log("[puppeteer] Instalando Chrome para Puppeteer…");
  execSync("npx puppeteer browsers install chrome", {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
}

main().catch((error) => {
  console.warn(
    "[puppeteer] No se pudo instalar Chrome automáticamente:",
    error instanceof Error ? error.message : error
  );
  process.exit(0);
});
