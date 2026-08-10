export function createSupersetBundle(approvedProfile, projection, options = {}) {
  if (approvedProfile?.schemaVersion !== 'chimpmaera.bi/approved-profile/v1') throw new Error('SUPERSET_APPROVED_PROFILE_REQUIRED');
  if (projection?.schemaVersion !== 'chimpmaera.bi/curated-projection/v1' || projection.approvalId !== approvedProfile.approvalId || projection.profileDigest !== approvedProfile.profileDigest) throw new Error('SUPERSET_PROFILE_BINDING_INVALID');
  return {
    schemaVersion:'chimpmaera.bi/superset-approved-profile-bundle/v1',
    source:{ kind:'APPROVED_PROFILE_PROJECTION', approvalId:approvedProfile.approvalId, profileDigest:approvedProfile.profileDigest, directSourceRoute:false },
    dataset:{ name:options.datasetName || 'cm_approved_profile', fields:projection.fields, rows:projection.rows },
    dashboard:{ title:options.title || 'Approved profile', charts:[{type:'table',name:'Approved profile drill-through',fields:projection.fields},{type:'big_number',name:'Approved aggregate count',metric:'COUNT(*)'}] },
  };
}
