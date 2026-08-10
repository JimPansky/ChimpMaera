export const dolibarr2203 = Object.freeze({
  fixtureVersion:'Dolibarr 22.0.3', domain:'sales-orders-invoices',
  bindings:{ orders:{schema:'dolidb',table:'llx_commande',columns:{created_at:'date_commande',status_code:'fk_statut',net_amount:'total_ht',tax_amount:'total_tva',gross_amount:'total_ttc'}}, invoices:{schema:'dolidb',table:'llx_facture',columns:{created_at:'datef',status_code:'fk_statut',net_amount:'total_ht',tax_amount:'total_tva',gross_amount:'total_ttc'}} },
  request:{ schemaVersion:'chimpmaera.bi/profile-request/v1', scope:{tenantId:'fixture-tenant',sourceId:'dolibarr-22.0.3',scanId:'cmdb:scan:sha256:a6ee331b9b864d675b9f4f5a',sourceDigest:'95fac104078380fe407a55d13f7f724920af0148b721c131d4405a55c6e318b9'}, selection:{rowSamples:false,objects:[{objectRef:'orders',columns:['created_at','status_code','net_amount','tax_amount','gross_amount']},{objectRef:'invoices',columns:['created_at','status_code','net_amount','tax_amount','gross_amount']}]}, budgets:{maxObjects:2,maxColumns:10,maxQueries:10,timeoutMs:30000,maxDistributionBuckets:12,rowSamples:false} },
});

export function deriveDolibarrKnowledge(approved, recomputation) {
  return { schemaVersion:'chimpmaera.bi/dolibarr-22.0.3-knowledge/v1', fixtureVersion:dolibarr2203.fixtureVersion, domain:dolibarr2203.domain, approvalId:approved.approvalId, profileDigest:approved.profileDigest, recomputation, facts:[{statement:'Orders and invoices are separate reviewed sales document populations in this fixture.',status:'FIXTURE_DECLARED',provenance:[approved.approvalId]},{statement:'Status meanings beyond the fixture declaration are not inferred.',status:'UNKNOWN_REVIEW_REQUIRED',provenance:[approved.profileDigest]}] };
}

export function dolibarrProjectionSpec(approved, recomputation) {
  const fields=['net_amount','tax_amount','gross_amount'].flatMap((columnRef)=>['orders','invoices'].map((objectRef)=>({objectRef,columnRef,aggregation:'SUM'})));
  return { approvalId:approved.approvalId, fields, rows:[{recordType:'ORDER',...recomputation.orders},{recordType:'INVOICE',...recomputation.invoices}] };
}
