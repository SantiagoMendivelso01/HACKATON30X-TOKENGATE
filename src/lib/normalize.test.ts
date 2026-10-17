import { describe, expect, it } from "vitest";
import { cleanText, extractDomain, nitCheckDigit, normalizeCity, normalizeName, normalizeNit, toE164 } from "./normalize";

describe("normalizeNit", () => {
  it("quita el DV pegado cuando coincide (formato SECOP)", () => {
    expect(nitCheckDigit("900430348")).toBe(7);
    expect(normalizeNit("9004303487")).toBe("900430348");
  });
  it("no recorta un número de 10 dígitos cuyo último dígito no es el DV", () => {
    expect(normalizeNit("9004303481")).toBe("9004303481");
  });
  it("acepta NIT con puntos y guion", () => {
    expect(normalizeNit("900.430.348-7")).toBe("900430348");
  });
  it("deja intacto el NIT de RUES", () => {
    expect(normalizeNit("902112402")).toBe("902112402");
  });
});

describe("limpieza", () => {
  it("trata 'No Provisto' como vacío", () => {
    expect(cleanText("No Provisto")).toBeNull();
    expect(extractDomain("No Provisto")).toBeNull();
  });
  it("teléfonos colombianos a E.164", () => {
    expect(toE164("3217212657")).toBe("+573217212657");
    expect(toE164("6013786137")).toBe("+576013786137");
    expect(toE164("123")).toBeNull();
  });
  it("dominio corporativo desde URL o email, ignorando gratuitos", () => {
    expect(extractDomain("HTTPS://WWW.GEOTOTAL.COM.CO/")).toBe("geototal.com.co");
    expect(extractDomain("COORDINACION@GEOTOTAL.COM.CO")).toBe("geototal.com.co");
    expect(extractDomain("ALGUIEN@GMAIL.COM")).toBeNull();
  });
  it("nombre sin sufijo societario ni tildes", () => {
    expect(normalizeName("Clínica Dental Sonrisa S.A.S.")).toBe("clinica dental sonrisa");
    expect(normalizeName("ORTHONAL SAS")).toBe("orthonal");
    expect(normalizeName("Odonto & Cía Ltda")).toBe(normalizeName("ODONTO Y CIA LTDA"));
  });
  it("Bogotá en todas sus variantes", () => {
    for (const v of ["BOGOTa", "BOGOTA D.C.", "Bogotá", "BOGOTa DC"]) expect(normalizeCity(v)).toBe("bogota");
  });
});
