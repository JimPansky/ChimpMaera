import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PAPERLESS_ZOO_TITLE_PREFIX,
  createPaperlessNgxZooAdapter,
} from "../demo/runtime/paperless-ngx-zoo-adapter.mjs";

const token = "p".repeat(48);

function document(id, title = `${PAPERLESS_ZOO_TITLE_PREFIX}Feeding Log ${id}`) {
  return {
    id,
    title,
    created: "2026-07-31T09:00:00+02:00",
    modified: "2026-07-31T09:05:00+02:00",
    archive_serial_number: id + 100,
    content: "must never cross the adapter boundary",
    owner: { email: "private@example.invalid" },
  };
}

test("adapter lists only sanitized synthetic zoo metadata with a redacted receipt", async () => {
  const calls = [];
  const adapter = createPaperlessNgxZooAdapter({
    apiToken: token,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({
        count: 2,
        next: null,
        previous: null,
        results: [
          document(7),
          document(8, "Private Human Resources Record"),
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const result = await adapter.listSyntheticZooDocuments();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.origin, "http://paperless:8000");
  assert.equal(calls[0].url.pathname, "/api/documents/");
  assert.equal(
    calls[0].url.searchParams.get("title__istartswith"),
    PAPERLESS_ZOO_TITLE_PREFIX,
  );
  assert.equal(calls[0].url.searchParams.get("ordering"), "id");
  assert.equal(calls[0].url.searchParams.get("page_size"), "20");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.headers.authorization, `Token ${token}`);
  assert.deepEqual(result.documents, [{
    id: 7,
    title: `${PAPERLESS_ZOO_TITLE_PREFIX}Feeding Log 7`,
    created: "2026-07-31T09:00:00+02:00",
    modified: "2026-07-31T09:05:00+02:00",
    archiveSerialNumber: 107,
  }]);
  assert.equal(result.receipt.returnedCount, 2);
  assert.equal(result.receipt.syntheticZooCount, 1);
  assert.equal(
    result.receipt.dataBoundary,
    "SYNTHETIC_METADATA_ONLY_NO_DOCUMENT_BYTES",
  );
  assert.match(result.receipt.receiptDigest, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(result).includes(token), false);
  assert.equal(JSON.stringify(result).includes("must never cross"), false);
  assert.equal(JSON.stringify(result).includes("private@example.invalid"), false);
});

test("adapter reads one numeric zoo record and denies a non-zoo record", async () => {
  const paths = [];
  const adapter = createPaperlessNgxZooAdapter({
    apiToken: token,
    fetchImpl: async (url) => {
      paths.push(url.pathname);
      return new Response(JSON.stringify(
        url.pathname.endsWith("/42/")
          ? document(42)
          : document(43, "Unrelated record"),
      ), { status: 200 });
    },
  });
  const result = await adapter.readSyntheticZooDocumentMetadata(42);
  assert.equal(result.document.id, 42);
  assert.equal(result.receipt.operation, "READ_SYNTHETIC_ZOO_METADATA");
  await assert.rejects(
    adapter.readSyntheticZooDocumentMetadata(43),
    /PAPERLESS_NON_ZOO_DOCUMENT_DENIED/,
  );
  assert.deepEqual(paths, ["/api/documents/42/", "/api/documents/43/"]);
});

test("configuration, IDs, provider errors and malformed or oversized data fail closed", async () => {
  for (const config of [
    { apiToken: "short" },
    { apiToken: token, baseUrl: "http://169.254.169.254/latest/meta-data" },
    { apiToken: token, baseUrl: "https://paperless.example.invalid/api" },
    { apiToken: token, maxResults: 21 },
  ]) assert.throws(
    () => createPaperlessNgxZooAdapter(config),
    /PAPERLESS_ADAPTER_CONFIG_INVALID_DENIED/,
  );

  let fetches = 0;
  const invalidIdAdapter = createPaperlessNgxZooAdapter({
    apiToken: token,
    fetchImpl: async () => { fetches += 1; },
  });
  for (const id of [0, -1, "1", 1.5]) await assert.rejects(
    invalidIdAdapter.readSyntheticZooDocumentMetadata(id),
    /PAPERLESS_DOCUMENT_ID_INVALID_DENIED/,
  );
  assert.equal(fetches, 0);

  const cases = [
    [new Response("denied", { status: 403 }), /PAPERLESS_PROVIDER_403_DENIED/],
    [new Response("not json", { status: 200 }), /PAPERLESS_RESPONSE_INVALID_DENIED/],
    [new Response(JSON.stringify({ count: 21, results: Array(21).fill(document(1)) }), {
      status: 200,
    }), /PAPERLESS_RESPONSE_INVALID_DENIED/],
    [new Response("{}", {
      status: 200,
      headers: { "content-length": String(256 * 1024 + 1) },
    }), /PAPERLESS_RESPONSE_TOO_LARGE_DENIED/],
  ];
  for (const [response, expected] of cases) {
    const adapter = createPaperlessNgxZooAdapter({
      apiToken: token,
      fetchImpl: async () => response,
    });
    await assert.rejects(adapter.listSyntheticZooDocuments(), expected);
  }

  const unavailable = createPaperlessNgxZooAdapter({
    apiToken: token,
    fetchImpl: async () => { throw new Error(`leak ${token}`); },
  });
  await assert.rejects(
    unavailable.listSyntheticZooDocuments(),
    (error) => error.message === "PAPERLESS_PROVIDER_UNAVAILABLE_DENIED"
      && !error.message.includes(token),
  );
});

test("stock demo remains DMS-off and does not claim or install Paperless", async () => {
  const [installer, compose, knownLimits] = await Promise.all([
    readFile(new URL("../demo/install.sh", import.meta.url), "utf8"),
    readFile(new URL("../demo/compose.yaml", import.meta.url), "utf8"),
    readFile(new URL("../docs/KNOWN-LIMITATIONS.md", import.meta.url), "utf8"),
  ]);
  assert.match(installer, /dms=off/);
  assert.doesNotMatch(compose, /^\s{2}paperless:/m);
  assert.match(knownLimits, /Paperless/i);
  assert.match(knownLimits, /disabled/i);
});

