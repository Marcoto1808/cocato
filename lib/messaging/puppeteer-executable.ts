import { existsSync } from "node:fs";

const RUTAS_CHROME_WINDOWS = [
  `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const RUTAS_CHROME_MACOS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  `${process.env.HOME ?? ""}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
];

const RUTAS_CHROME_LINUX = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

function primeraRutaExistente(rutas: string[]): string | undefined {
  for (const ruta of rutas) {
    if (ruta && existsSync(ruta)) return ruta;
  }
  return undefined;
}

function chromeDelSistema(): string | undefined {
  if (process.platform === "win32") {
    return primeraRutaExistente(RUTAS_CHROME_WINDOWS);
  }
  if (process.platform === "darwin") {
    return primeraRutaExistente(RUTAS_CHROME_MACOS);
  }
  return primeraRutaExistente(RUTAS_CHROME_LINUX);
}

/**
 * Resuelve el ejecutable de Chrome/Chromium para Puppeteer (whatsapp-web.js).
 * Orden: PUPPETEER_EXECUTABLE_PATH → bundled de Puppeteer → Chrome del sistema.
 */
export async function resolverEjecutablePuppeteer(): Promise<string> {
  const desdeEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (desdeEnv && existsSync(desdeEnv)) {
    return desdeEnv;
  }

  try {
    const puppeteerMod = await import("puppeteer");
    const puppeteer = puppeteerMod.default ?? puppeteerMod;
    const bundled = puppeteer.executablePath();
    if (bundled && existsSync(bundled)) {
      return bundled;
    }
  } catch {
    // Bundled no instalado; intentar Chrome del sistema.
  }

  const sistema = chromeDelSistema();
  if (sistema) {
    return sistema;
  }

  throw new Error(
    "No se encontró Chrome para Puppeteer. Ejecuta `npm install` (instala el navegador automáticamente) o define PUPPETEER_EXECUTABLE_PATH."
  );
}
