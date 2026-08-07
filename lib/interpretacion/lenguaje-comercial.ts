function normalizarTextoPedido(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

const FRASES_COMERCIALES = [
  "quiero pedir",
  "quisiera",
  "me das",
  "me da",
  "mándame",
  "mandame",
  "échame",
  "echame",
  "necesito",
  "ocupo",
  "ponme",
  "dame",
  "quiero",
  "qiero",
  "manda",
  "pon",
  "envíame",
  "enviame",
  "envia",
  "envía",
  "me gustaría",
  "me gustaria",
  "déjame",
  "dejame",
  "por favor",
];

const FRASES_ORDENADAS = [...FRASES_COMERCIALES].sort(
  (a, b) => b.length - a.length
);

function quitarPrefijoComercial(texto: string, frase: string): string | null {
  const textoNorm = normalizarTextoPedido(texto);
  const fraseNorm = normalizarTextoPedido(frase);
  if (!textoNorm.startsWith(fraseNorm)) return null;

  const palabrasFrase = fraseNorm.split(/\s+/).filter(Boolean).length;
  const palabras = texto.trim().split(/\s+/).filter(Boolean);
  if (palabras.length < palabrasFrase) return null;

  const inicio = normalizarTextoPedido(
    palabras.slice(0, palabrasFrase).join(" ")
  );
  if (inicio !== fraseNorm) return null;

  return palabras.slice(palabrasFrase).join(" ");
}

function quitarPorFavor(texto: string): string {
  let t = texto.trim();

  t = t.replace(/^por\s+favor[,.\s]+/i, "").trim();
  t = t.replace(/[,.\s]+por\s+favor[.!?]*$/i, "").trim();

  return t;
}

/** Elimina frases comerciales antes de interpretar cantidad y producto. */
export function normalizarLenguajeComercial(texto: string): string {
  let t = texto.trim().replace(/[.!?]+$/, "");
  if (!t) return t;

  let cambio = true;
  while (cambio) {
    cambio = false;

    for (const frase of FRASES_ORDENADAS) {
      const resto = quitarPrefijoComercial(t, frase);
      if (resto !== null) {
        t = resto;
        cambio = true;
        break;
      }
    }

    const sinPorFavor = quitarPorFavor(t);
    if (sinPorFavor !== t) {
      t = sinPorFavor;
      cambio = true;
    }
  }

  return t.trim();
}
