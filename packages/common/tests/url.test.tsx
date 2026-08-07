import { isLocalLink, normalizeLink, toValidURL } from "../src/url";

describe("normalizeLink", () => {
  // NOTE not an extensive XSS test suite, just to check if we're not
  // regressing in sanitization
  it("should sanitize links", () => {
    expect(
      // eslint-disable-next-line no-script-url
      normalizeLink(`javascript://%0aalert(document.domain)`).startsWith(
        // eslint-disable-next-line no-script-url
        `javascript:`,
      ),
    ).toBe(false);
    expect(normalizeLink("ola")).toBe("ola");
    expect(normalizeLink(" ola")).toBe("ola");

    expect(normalizeLink("https://www.excalidraw.com")).toBe(
      "https://www.excalidraw.com",
    );
    expect(normalizeLink("www.excalidraw.com")).toBe("www.excalidraw.com");
    expect(normalizeLink("/ola")).toBe("/ola");
    expect(normalizeLink("http://test")).toBe("http://test");
    expect(normalizeLink("ftp://test")).toBe("ftp://test");
    expect(normalizeLink("file://")).toBe("file://");
    expect(normalizeLink("file://")).toBe("file://");
    expect(normalizeLink("[test](https://test)")).toBe("[test](https://test)");
    expect(normalizeLink("[[test]]")).toBe("[[test]]");
    expect(normalizeLink("<test>")).toBe("<test>");
    expect(normalizeLink("test&")).toBe("test&");
  });

  it("should return an empty string for blank input", () => {
    expect(normalizeLink("")).toBe("");
    expect(normalizeLink("   ")).toBe("");
  });

  it("should escape double quotes so the result is safe in an HTML attribute", () => {
    const normalized = normalizeLink(`https://example.com/?q="x"`);

    expect(normalized).not.toContain(`"`);
    expect(normalized).toContain("&quot;");
  });
});

describe("isLocalLink", () => {
  it("should treat root-relative paths as local", () => {
    expect(isLocalLink("/foo")).toBe(true);
  });

  it("should treat links on the current origin as local", () => {
    expect(isLocalLink(`${location.origin}/foo`)).toBe(true);
  });

  it("should treat other origins as non-local", () => {
    expect(isLocalLink("https://example.com/foo")).toBe(false);
  });

  it("should handle null", () => {
    expect(isLocalLink(null)).toBe(false);
  });
});

describe("toValidURL", () => {
  it("should expand a root-relative path against the current origin", () => {
    expect(toValidURL("/foo")).toBe(`${location.origin}/foo`);
  });

  it("should pass a valid absolute url through", () => {
    expect(toValidURL("https://excalidraw.com/foo")).toBe(
      "https://excalidraw.com/foo",
    );
  });

  it("should fall back to about:blank when the input does not parse as a url", () => {
    // normalizeLink lets these through untouched — it only strips dangerous
    // protocols — so toValidURL is the layer that has to reject them
    expect(toValidURL("not a url")).toBe("about:blank");
    expect(toValidURL("")).toBe("about:blank");
  });

  it("should fall back to about:blank for javascript: urls", () => {
    // eslint-disable-next-line no-script-url
    expect(toValidURL("javascript:alert(1)")).toBe("about:blank");
  });
});
