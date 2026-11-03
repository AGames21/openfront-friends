import { describe, it, expect } from "vitest";
import { validateDisplayName } from "../src/client/FriendsDisplayName";
describe("public game display names", () => {
  it("normalizes whitespace without changing the chosen spelling", () =>
    expect(validateDisplayName("  Map   Master-7  ")).toBe("Map Master-7"));
  it.each([
    "",
    "  ",
    "A",
    "a".repeat(21),
    "name@example.com",
    "<script>",
    "🚀Rocket",
  ])("rejects invalid public names: %s", (name) =>
    expect(() => validateDisplayName(name)).toThrow(),
  );
  it("accepts the twenty-character limit", () =>
    expect(validateDisplayName("A".repeat(20))).toHaveLength(20));
});
