import { describe, expect, it } from "vitest";
import { inkOn } from "./contrast";

describe("inkOn", () => {
  it("texto oscuro sobre lima, blanco sobre colores oscuros", () => {
    expect(inkOn("#CBE850")).toBe("#1a1a1c");
    expect(inkOn("#5B3DF5")).toBe("#ffffff");
    expect(inkOn("#000000")).toBe("#ffffff");
    expect(inkOn("nope")).toBe("#1a1a1c");
  });
});
