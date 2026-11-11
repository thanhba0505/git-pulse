import { redactTokens } from "./token-redactor.util";

describe("token-redactor.util", () => {
  it("should redact classic ghp_ tokens", () => {
    const raw =
      "Error occurred with token ghp_1234567890abcdef1234567890abcdef1234 while fetching";
    const redacted = redactTokens(raw);
    expect(redacted).toBe(
      "Error occurred with token [REDACTED_GITHUB_TOKEN] while fetching",
    );
  });

  it("should redact fine-grained github_pat_ tokens", () => {
    const rawPat = "github_pat_" + "a".repeat(82);
    const raw = `Authorization: Bearer ${rawPat}`;
    const redacted = redactTokens(raw);
    expect(redacted).toBe("Authorization: Bearer [REDACTED_GITHUB_TOKEN]");
  });

  it("should redact gho_ OAuth tokens", () => {
    const raw =
      "OAuth returned token: gho_1234567890abcdef1234567890abcdef1234";
    const redacted = redactTokens(raw);
    expect(redacted).toBe("OAuth returned token: [REDACTED_GITHUB_TOKEN]");
  });

  it("should sanitize nested JSON objects without mutating original", () => {
    const obj = {
      user: "dev",
      secret: "ghp_1234567890abcdef1234567890abcdef1234",
    };
    const redacted = redactTokens(obj);
    expect(redacted).toContain("[REDACTED_GITHUB_TOKEN]");
    expect(redacted).not.toContain("ghp_1234567890abcdef1234567890abcdef1234");
  });
});
