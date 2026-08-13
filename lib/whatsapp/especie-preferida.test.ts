import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aplicarEspeciePreferidaAlMensaje,
  combinarLineaConAclaracion,
} from "@/lib/whatsapp/especie-preferida";

describe("aplicarEspeciePreferidaAlMensaje", () => {
  it("inyecta res en bistec sin especie", () => {
    assert.equal(
      aplicarEspeciePreferidaAlMensaje("3 kg de bistec", "Res"),
      "3 kg de bistec de res"
    );
  });

  it("inyecta cerdo en molida sin especie", () => {
    assert.equal(
      aplicarEspeciePreferidaAlMensaje("200 pesos de molida", "Cerdo"),
      "200 pesos de molida de cerdo"
    );
  });

  it("no altera segmentos que ya traen especie", () => {
    assert.equal(
      aplicarEspeciePreferidaAlMensaje("3 kg de bistec de cerdo", "Res"),
      "3 kg de bistec de cerdo"
    );
  });

  it("no altera costilla", () => {
    assert.equal(
      aplicarEspeciePreferidaAlMensaje("2 costillas", "Res"),
      "2 costillas"
    );
  });
});

describe("combinarLineaConAclaracion", () => {
  it('aclara "3 kg de bistec" con "bistec de cerdo"', () => {
    assert.equal(
      combinarLineaConAclaracion("3 kg de bistec", "bistec de cerdo"),
      "3 kg de bistec de cerdo"
    );
  });

  it('aclara con "es bistec de cerdo" vía parse previo', () => {
    assert.equal(
      combinarLineaConAclaracion("3 kg de bistec", "bistec de cerdo"),
      "3 kg de bistec de cerdo"
    );
  });
});
