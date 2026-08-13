export type OpcionConversacional<T extends string = string> = {
  id: T;
  sinonimos: string[];
};

export function normalizarEntradaConversacional(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function coincideNumeroOpcion(normalizado: string, indice: number): boolean {
  const token = String(indice);
  return normalizado === token;
}

function coincideSinonimo(normalizado: string, sinonimo: string): boolean {
  const sinNorm = normalizarEntradaConversacional(sinonimo);
  if (!sinNorm) return false;
  if (normalizado === sinNorm) return true;
  if (normalizado.startsWith(`${sinNorm} `)) return true;
  if (sinNorm.includes(" ") && normalizado.includes(sinNorm)) return true;
  return false;
}

/**
 * Resuelve la opción elegida por número o texto natural.
 * `opciones[0]` corresponde al número 1, `opciones[1]` al 2, etc.
 */
export function resolverOpcionConversacional<T extends string>(
  mensaje: string,
  opciones: OpcionConversacional<T>[]
): T | null {
  const normalizado = normalizarEntradaConversacional(mensaje);
  if (!normalizado || opciones.length === 0) return null;

  const aceptarNumeros = opciones.length > 1;

  for (let indice = 0; indice < opciones.length; indice++) {
    const opcion = opciones[indice];

    if (aceptarNumeros && coincideNumeroOpcion(normalizado, indice + 1)) {
      return opcion.id;
    }

    for (const sinonimo of opcion.sinonimos) {
      if (coincideSinonimo(normalizado, sinonimo)) {
        return opcion.id;
      }
    }
  }

  return null;
}

export const OPCION_SEGUIR_AGREGANDO = "seguir_agregando";
export const OPCION_TERMINAR_PEDIDO = "terminar";

/** Respuestas a "¿Desea agregar algo más?" */
export const OPCIONES_DESEAR_AGREGAR_MAS: OpcionConversacional<
  typeof OPCION_SEGUIR_AGREGANDO | typeof OPCION_TERMINAR_PEDIDO
>[] = [
  {
    id: OPCION_SEGUIR_AGREGANDO,
    sinonimos: [
      "si",
      "claro",
      "correcto",
      "ok",
      "si por favor",
      "agregar",
      "agregar algo mas",
      "agregar mas",
      "quiero agregar",
      "continuar agregando",
      "continuar agregando productos",
    ],
  },
  {
    id: OPCION_TERMINAR_PEDIDO,
    sinonimos: [
      "no",
      "nop",
      "no gracias",
      "ya",
      "es todo",
      "eso es todo",
      "eso seria todo",
      "nada mas",
      "terminar",
      "continuar",
      "finalizar",
      "gracias",
      "listo",
      "confirmar",
      "confirmo",
      "termine",
      "terminé",
      "no quiero nada mas",
      "fin",
      "ya esta",
    ],
  },
];

export const OPCIONES_ENTREGA_IDS = {
  envio: "envio",
  recoger: "recoger",
} as const;

export type OpcionEntregaId =
  (typeof OPCIONES_ENTREGA_IDS)[keyof typeof OPCIONES_ENTREGA_IDS];

/** Respuestas a "¿Cómo desea recibir su pedido?" */
export const OPCIONES_ENTREGA: OpcionConversacional<OpcionEntregaId>[] = [
  {
    id: OPCIONES_ENTREGA_IDS.envio,
    sinonimos: [
      "envio",
      "enviar",
      "domicilio",
      "a domicilio",
      "mandamelo",
      "mandame",
      "mandamelo a domicilio",
    ],
  },
  {
    id: OPCIONES_ENTREGA_IDS.recoger,
    sinonimos: [
      "recoger",
      "recojo",
      "paso por el",
      "voy por el",
      "pasare",
      "sucursal",
    ],
  },
];

export const OPCIONES_MENU_PRINCIPAL_IDS = {
  escribir: "1",
  guiado: "2",
  repetir: "3",
} as const;

export type OpcionMenuPrincipalId =
  (typeof OPCIONES_MENU_PRINCIPAL_IDS)[keyof typeof OPCIONES_MENU_PRINCIPAL_IDS];

export const OPCIONES_MENU_PRINCIPAL: OpcionConversacional<OpcionMenuPrincipalId>[] =
  [
    {
      id: "1",
      sinonimos: ["escribir", "escribir mi pedido", "pedido libre", "texto"],
    },
    {
      id: "2",
      sinonimos: ["guiado", "pedido guiado", "asistido"],
    },
    {
      id: "3",
      sinonimos: [
        "repetir",
        "ultimo",
        "ultimo pedido",
        "lo mismo",
        "repetir mi ultimo pedido",
      ],
    },
  ];

export const OPCION_CONFIRMAR = "confirmar";
export const OPCION_RECHAZAR = "rechazar";

/** Respuestas afirmativas / negativas genéricas (sí = 1, no = 2). */
export const OPCIONES_SI_NO: OpcionConversacional<
  typeof OPCION_CONFIRMAR | typeof OPCION_RECHAZAR
>[] = [
  {
    id: OPCION_CONFIRMAR,
    sinonimos: ["si", "confirmo", "confirmar", "adelante", "ok", "vale", "claro"],
  },
  {
    id: OPCION_RECHAZAR,
    sinonimos: [
      "no",
      "cancelar",
      "cancelo",
      "olvidalo",
      "anular",
      "ya",
      "es todo",
      "gracias",
    ],
  },
];

/** Rechazo explícito sin frases de cierre de pedido (ya, gracias, es todo). */
export const OPCIONES_CANCELACION: OpcionConversacional<
  typeof OPCION_RECHAZAR
>[] = [
  {
    id: OPCION_RECHAZAR,
    sinonimos: ["no", "cancelar", "cancelo", "olvidalo", "anular"],
  },
];
