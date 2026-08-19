import { canonicalJson, sha256 } from "./enforcement-gate.mjs";

export const PAPERLESS_ZOO_READ_RECEIPT_SCHEMA =
  "chimpmaera.demo/paperless-zoo-read-receipt/v1";
export const PAPERLESS_ZOO_ADAPTER_ID = "paperless-ngx-zoo-readonly";
export const PAPERLESS_ZOO_ADAPTER_VERSION = "1.0.0";
export const PAPERLESS_ZOO_TITLE_PREFIX = "PanSphaira Zoo - ";

const FIXED_BASE_URL = "http://paperless:8000/api";
const MAX_RESPONSE_BYTES = 256 * 1024;

function providerError(code) {
  const error = new Error(code);
  error.paperlessAdapterError = true;
  return error;
}
function sanitizeDocument(value) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || !Number.isSafeInteger(value.id)
    || value.id < 1
    || typeof value.title !== "string"
    || value.title.length > 200
    || typeof value.created !== "string"
    || value.created.length > 80
    || typeof value.modified !== "string"
    || value.modified.length > 80
    || !(
      value.archive_serial_number === null
      || (Number.isSafeInteger(value.archive_serial_number)
        && value.archive_serial_number >= 0)
    )
  ) throw providerError("PAPERLESS_RESPONSE_INVALID_DENIED");
  return {
    id: value.id,
    title: value.title,
    created: value.created,
    modified: value.modified,
    archiveSerialNumber: value.archive_serial_number,
  };
}

function receipt(operation, requestDescriptor, raw, documents) {
  const core = {
    schemaVersion: PAPERLESS_ZOO_READ_RECEIPT_SCHEMA,
    adapter: {
      adapterId: PAPERLESS_ZOO_ADAPTER_ID,
      adapterVersion: PAPERLESS_ZOO_ADAPTER_VERSION,
      instanceId: "paperless-local-compose",
    },
    operation,
    requestDigest: sha256(canonicalJson(requestDescriptor)),
    responseDigest: sha256(canonicalJson(raw)),
    documentsDigest: sha256(canonicalJson(documents)),
    returnedCount: Array.isArray(raw.results) ? raw.results.length : 1,
    syntheticZooCount: documents.length,
    dataBoundary: "SYNTHETIC_METADATA_ONLY_NO_DOCUMENT_BYTES",
    outcome: "PROVIDER_METADATA_READ_VERIFIED",
  };
  return { ...core, receiptDigest: sha256(canonicalJson(core)) };
}

export function createPaperlessNgxZooAdapter({
  baseUrl = FIXED_BASE_URL,
  apiToken,
  fetchImpl = fetch,
  maxResults = 20,
}) {
  if (
    baseUrl !== FIXED_BASE_URL
    || typeof apiToken !== "string"
    || apiToken.length < 32
    || typeof fetchImpl !== "function"
    || !Number.isSafeInteger(maxResults)
    || maxResults < 1
    || maxResults > 20
  ) throw new Error("PAPERLESS_ADAPTER_CONFIG_INVALID_DENIED");

  const call = async (path, query = undefined) => {
    const url = new URL(`${FIXED_BASE_URL}${path}`);
    if (query !== undefined) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, String(value));
      }
    }
    let response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        redirect: "error",
        headers: {
          accept: "application/json",
          authorization: `Token ${apiToken}`,
        },
      });
    } catch (error) {
      if (error?.paperlessAdapterError === true) throw error;
      throw providerError("PAPERLESS_PROVIDER_UNAVAILABLE_DENIED");
    }
    const declaredLength = Number(response.headers?.get?.("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
      throw providerError("PAPERLESS_RESPONSE_TOO_LARGE_DENIED");
    }
    if (!response.ok) {
      throw providerError(`PAPERLESS_PROVIDER_${response.status}_DENIED`);
    }
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) {
      throw providerError("PAPERLESS_RESPONSE_TOO_LARGE_DENIED");
    }
    try {
      return JSON.parse(text);
    } catch {
      throw providerError("PAPERLESS_RESPONSE_INVALID_DENIED");
    }
  };

  return Object.freeze({
    adapterId: PAPERLESS_ZOO_ADAPTER_ID,
    adapterVersion: PAPERLESS_ZOO_ADAPTER_VERSION,
    mode: "READ_ONLY_SYNTHETIC_METADATA",

    async listSyntheticZooDocuments() {
      const requestDescriptor = {
        operation: "LIST_SYNTHETIC_ZOO_METADATA",
        titlePrefix: PAPERLESS_ZOO_TITLE_PREFIX,
        ordering: "id",
        maximumResults: maxResults,
      };
      const raw = await call("/documents/", {
        title__istartswith: PAPERLESS_ZOO_TITLE_PREFIX,
        ordering: "id",
        page_size: maxResults,
      });
      if (
        raw === null
        || typeof raw !== "object"
        || Array.isArray(raw)
        || !Number.isSafeInteger(raw.count)
        || raw.count < 0
        || !Array.isArray(raw.results)
        || raw.results.length > maxResults
      ) throw providerError("PAPERLESS_RESPONSE_INVALID_DENIED");
      const sanitized = raw.results.map(sanitizeDocument);
      const documents = sanitized.filter(({ title }) =>
        title.startsWith(PAPERLESS_ZOO_TITLE_PREFIX)
      );
      return {
        status: "PASS",
        documents,
        receipt: receipt(
          "LIST_SYNTHETIC_ZOO_METADATA",
          requestDescriptor,
          raw,
          documents,
        ),
      };
    },

    async readSyntheticZooDocumentMetadata(documentId) {
      if (!Number.isSafeInteger(documentId) || documentId < 1) {
        throw new Error("PAPERLESS_DOCUMENT_ID_INVALID_DENIED");
      }
      const requestDescriptor = {
        operation: "READ_SYNTHETIC_ZOO_METADATA",
        documentId,
      };
      const raw = await call(`/documents/${documentId}/`);
      const document = sanitizeDocument(raw);
      if (!document.title.startsWith(PAPERLESS_ZOO_TITLE_PREFIX)) {
        throw providerError("PAPERLESS_NON_ZOO_DOCUMENT_DENIED");
      }
      const documents = [document];
      return {
        status: "PASS",
        document,
        receipt: receipt(
          "READ_SYNTHETIC_ZOO_METADATA",
          requestDescriptor,
          raw,
          documents,
        ),
      };
    },
  });
}
