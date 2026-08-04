import { readFileSync } from "node:fs";
import { posix } from "node:path";
import { defineConfig, type HeadConfig } from "vitepress";

const repositoryUrl = "https://github.com/JimPansky/ChimpMaera";
const siteUrl = "https://jimpansky.github.io/ChimpMaera/";
const siteDescription =
  "Open-source local proof of concept for governed, verifiable AI-agent actions across business systems.";
const socialImage = "https://opengraph.githubassets.com/1/JimPansky/ChimpMaera";
const releaseMetadata = JSON.parse(
  readFileSync(new URL("../../release/governance.json", import.meta.url), "utf8"),
) as { currentRelease: { tag: string } };

const curatedSitemapPaths = new Set([
  "",
  "alternatives",
  "AGENT-WORK-EVENT-CONTRACT",
  "capabilities",
  "examples",
  "EXTENSION-ASSURANCE-PROFILES",
  "KNOWN-LIMITATIONS",
  "QUICKSTART",
  "RESOURCE-PLANE-PROFILES",
  "roadmap",
  "SECURE-DEFAULT-PROOF",
  "use-cases/crm-erp-approval-readback",
  "use-cases/governed-agent-actions",
]);

function publicPath(relativePath: string): string {
  const route = relativePath
    .replace(/(^|\/)index\.md$/, "$1")
    .replace(/\.md$/, "");
  return route ? `${route}` : "";
}

export default defineConfig({
  lang: "en-US",
  title: "ChimpMaera",
  description: siteDescription,
  base: "/ChimpMaera/",
  outDir: "../dist/docs-site",
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ["development/**"],
  markdown: {
    config(md) {
      md.core.ruler.push("chimpmaera-repository-links", (state) => {
        for (const token of state.tokens) {
          if (token.type !== "inline" || !token.children) continue;
          for (const child of token.children) {
            if (child.type !== "link_open") continue;
            const hrefIndex = child.attrIndex("href");
            if (hrefIndex < 0) continue;
            const href = child.attrs?.[hrefIndex]?.[1] ?? "";
            if (!href.startsWith("../")) continue;

            const [pathname, fragment = ""] = href.split("#", 2);
            const resolved = posix.normalize(
              posix.join(posix.dirname(state.env.relativePath), pathname),
            );
            if (!resolved.startsWith("../")) continue;

            const repositoryPath = resolved.replace(/^\.\.\//, "");
            const suffix = fragment ? `#${fragment}` : "";
            child.attrSet("href", `${repositoryUrl}/blob/main/${repositoryPath}${suffix}`);
          }
        }
      });
    },
  },
  sitemap: {
    hostname: siteUrl,
    transformItems: (items) => items.filter((item) => {
      const path = item.url.replace(/^https:\/\/jimpansky\.github\.io\/ChimpMaera\//, "").replace(/\/$/, "");
      return curatedSitemapPaths.has(path);
    }),
  },
  transformHead({ pageData }): HeadConfig[] {
    const route = publicPath(pageData.relativePath);
    const canonicalUrl = new URL(route, siteUrl).href;
    const title = pageData.title ? `${pageData.title} | ChimpMaera` : "ChimpMaera";
    const description = pageData.description || siteDescription;
    const softwareSourceCode = {
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      name: "ChimpMaera",
      description: siteDescription,
      codeRepository: repositoryUrl,
      url: canonicalUrl,
      license: "https://www.apache.org/licenses/LICENSE-2.0",
      version: releaseMetadata.currentRelease.tag.replace(/^v/, ""),
      runtimePlatform: ["Linux x86_64", "Node.js 24", "Docker Engine with Docker Compose v2"],
      developmentStatus: "active",
    };

    return [
      ["link", { rel: "canonical", href: canonicalUrl }],
      ["meta", { property: "og:type", content: "website" }],
      ["meta", { property: "og:site_name", content: "ChimpMaera" }],
      ["meta", { property: "og:title", content: title }],
      ["meta", { property: "og:description", content: description }],
      ["meta", { property: "og:url", content: canonicalUrl }],
      ["meta", { property: "og:image", content: socialImage }],
      ["meta", { name: "twitter:card", content: "summary_large_image" }],
      ["script", { type: "application/ld+json" }, JSON.stringify(softwareSourceCode).replace(/</g, "\\u003c")],
    ];
  },
  themeConfig: {
    nav: [
      {
        text: "Use cases",
        items: [
          { text: "Governed agent actions", link: "/use-cases/governed-agent-actions" },
          { text: "CRM → ERP approval and readback", link: "/use-cases/crm-erp-approval-readback" },
        ],
      },
      { text: "Capabilities", link: "/capabilities" },
      { text: "Examples", link: "/examples" },
      { text: "Alternatives", link: "/alternatives" },
      { text: "Roadmap", link: "/roadmap" },
      { text: "Evidence", link: "/SECURE-DEFAULT-PROOF" },
      { text: "GitHub", link: repositoryUrl },
    ],
    sidebar: [
      {
        text: "Start",
        items: [
          { text: "Overview", link: "/" },
          { text: "Quickstart", link: "/QUICKSTART" },
          { text: "Governed agent actions", link: "/use-cases/governed-agent-actions" },
          { text: "CRM → ERP approval and readback", link: "/use-cases/crm-erp-approval-readback" },
        ],
      },
      {
        text: "Verify",
        items: [
          { text: "Capability evidence", link: "/capabilities" },
          { text: "Agent-work event contract", link: "/AGENT-WORK-EVENT-CONTRACT" },
          { text: "Extension assurance profiles", link: "/EXTENSION-ASSURANCE-PROFILES" },
          { text: "Resource-plane profiles", link: "/RESOURCE-PLANE-PROFILES" },
          { text: "Reproducible examples", link: "/examples" },
          { text: "SAFE_GUIDED proof", link: "/SECURE-DEFAULT-PROOF" },
          { text: "Known limitations", link: "/KNOWN-LIMITATIONS" },
        ],
      },
      {
        text: "Choose and follow",
        items: [
          { text: "When to use an alternative", link: "/alternatives" },
          { text: "Now / Next / Later", link: "/roadmap" },
        ],
      },
    ],
    editLink: {
      pattern: `${repositoryUrl}/edit/main/docs/:path`,
      text: "Edit this page on GitHub",
    },
    socialLinks: [{ icon: "github", link: repositoryUrl }],
    search: { provider: "local" },
    footer: {
      message: "Local synthetic proof of concept — not a production release or security certification.",
      copyright: "Licensed under Apache-2.0.",
    },
  },
});
