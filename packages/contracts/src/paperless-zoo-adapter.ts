export const PAPERLESS_ZOO_READ_RECEIPT_API_VERSION =
  "chimpmaera.demo/paperless-zoo-read-receipt/v1" as const;

export type PaperlessZooDocumentMetadataV1 = Readonly<{
  id: number;
  title: string;
  created: string;
  modified: string;
  archiveSerialNumber: number | null;
}>;

export type PaperlessZooReadReceiptV1 = Readonly<{
  schemaVersion: typeof PAPERLESS_ZOO_READ_RECEIPT_API_VERSION;
  adapter: Readonly<{
    adapterId: "paperless-ngx-zoo-readonly";
    adapterVersion: "1.0.0";
    instanceId: "paperless-local-compose";
  }>;
  operation: "LIST_SYNTHETIC_ZOO_METADATA" | "READ_SYNTHETIC_ZOO_METADATA";
  requestDigest: string;
  responseDigest: string;
  documentsDigest: string;
  returnedCount: number;
  syntheticZooCount: number;
  dataBoundary: "SYNTHETIC_METADATA_ONLY_NO_DOCUMENT_BYTES";
  outcome: "PROVIDER_METADATA_READ_VERIFIED";
  receiptDigest: string;
}>;

export interface PaperlessNgxZooReadAdapterV1 {
  readonly adapterId: "paperless-ngx-zoo-readonly";
  readonly adapterVersion: "1.0.0";
  readonly mode: "READ_ONLY_SYNTHETIC_METADATA";
  listSyntheticZooDocuments(): Promise<Readonly<{
    status: "PASS";
    documents: readonly PaperlessZooDocumentMetadataV1[];
    receipt: PaperlessZooReadReceiptV1;
  }>>;
  readSyntheticZooDocumentMetadata(documentId: number): Promise<Readonly<{
    status: "PASS";
    document: PaperlessZooDocumentMetadataV1;
    receipt: PaperlessZooReadReceiptV1;
  }>>;
}

