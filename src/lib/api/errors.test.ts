import { describe, expect, it } from "vitest";
import { ApiError, toApiError } from "./errors";

describe("toApiError", () => {
  it("preserves PostgREST error messages and codes", () => {
    const error = toApiError({
      code: "PGRST205",
      message: "Could not find the table 'public.catalog_cart_items' in the schema cache",
    });

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe(
      "Could not find the table 'public.catalog_cart_items' in the schema cache (PGRST205)",
    );
  });

  it("uses the fallback only when the database error has no message", () => {
    expect(toApiError({ code: "PGRST205" }, "Could not load your bag.").message).toBe(
      "Could not load your bag.",
    );
  });
});
