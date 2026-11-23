import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function buildManifest(coverage, code) {
 const notice=coverage.notices.find(n=>n.notice_code===code);
 if(!notice) throw Error('Unknown notice');
 if(!notice.scope_identification_complete) throw Error('Incomplete scope cannot produce a full certification manifest');
 const seen=new Set();
 const devices=notice.scope.map(s=>{
  if(seen.has(s.provision_id)) throw Error('Duplicate provision'); seen.add(s.provision_id);
  const prepared=s.preparation_status.startsWith('prepared_');
  if(prepared!==Boolean(s.version_id)) throw Error('Preparation/version mismatch');
  if(s.certified_for_notice) throw Error('This evidence-only manifest cannot promote certification');
  const outcome=prepared?'text_prepared':s.preparation_status==='not_enacted_veto'?'veto_no_enacted_text':s.preparation_status.startsWith('pending_official_source_conflict')?'documentary_conflict':'pending_evidence';
  return {...s,outcome};
 });
 if(devices.length!==notice.identified_catalog_article_slots) throw Error('Incomplete device enumeration');
 const blockers=[];
 if(!notice.cutoff_confirmed) blockers.push('official_cutoff_unconfirmed');
 if(!notice.source_chain_complete) blockers.push('official_rectification_chain_incomplete');
 if(devices.some(d=>!d.version_id&&d.outcome!=='veto_no_enacted_text')) blockers.push('unresolved_documentary_evidence');
 if(devices.some(d=>d.preparation_status==='prepared_effective_date_requires_review')) blockers.push('effective_dates_require_material_review');
 const prepared=devices.filter(d=>d.outcome==='text_prepared').length;
 return {schema_version:1,notice_code:code,evidence_sha256:createHash('sha256').update(JSON.stringify(coverage)).digest('hex'),
  identified_slots:devices.length,prepared_texts:prepared,prepared_percent:100*prepared/devices.length,
  classified_slots:devices.length,certified_for_notice:0,certified_percent:0,certification_ready:blockers.length===0,blockers,devices};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [input,code,output]=process.argv.slice(2);
 const manifest=buildManifest(JSON.parse(readFileSync(input,'utf8')),code);
 writeFileSync(output,JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify({...manifest,devices:undefined}));
}
