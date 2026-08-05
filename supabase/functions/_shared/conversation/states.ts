/** Estados comerciales del Conversation Engine (Sprint 1). */
export type EstadoComercialConversacion = "NUEVA" | "MENU_PRINCIPAL";

export const ESTADOS_COMERCIALES: EstadoComercialConversacion[] = [
  "NUEVA",
  "MENU_PRINCIPAL",
];

export function esEstadoComercialConversacion(
  valor: string | null | undefined
): valor is EstadoComercialConversacion {
  return (
    valor === "NUEVA" ||
    valor === "MENU_PRINCIPAL"
  );
}

/** Detecta saludos simples sin IA (p. ej. "Hola", "Buenos días"). */
export function esSaludo(texto: string): boolean {
  const normalizado = texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizado) return false;

  const saludos = [
    "hola",
    "buenos dias",
    "buenas tardes",
    "buenas noches",
    "buen dia",
    "que tal",
    "hey",
    "hi",
  ];

  return saludos.some(
    (saludo) =>
      normalizado === saludo ||
      normalizado.startsWith(`${saludo} `) ||
      normalizado.endsWith(` ${saludo}`)
  );
}

export function nombreParaSaludo(input: {
  propietario: string | null;
  nombre_negocio: string;
}): string {
  const propietario = input.propietario?.trim();
  if (propietario) return propietario;
  return input.nombre_negocio.trim();
}

export function construirMenuPrincipal(nombre: string): string {
  return [
    `Hola, Don ${nombre}.`,
    "",
    "¿Cómo le podemos ayudar?",
    "",
    "1. Hacer pedido",
    "2. Escribir mi pedido",
    "3. Repetir mi último pedido",
  ].join("\n");
}

export const MENSAJE_CLIENTE_NO_EXISTE =
  "Gracias por contactarnos. Un vendedor continuará la conversación contigo en breve.";
