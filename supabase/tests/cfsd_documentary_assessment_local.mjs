import {readFileSync,readdirSync}from'node:fs';
import{createHash}from'node:crypto';
import assert from'node:assert/strict';
import{buildManifest}from'../../scripts/notice-certification-readiness.mjs';
const read=p=>readFileSync(new URL('../evidence/'+p,import.meta.url),'utf8');
const json=p=>JSON.parse(read(p));const hash=x=>createHash('sha256').update(x).digest('hex');
const cov=json('p0-device-coverage-20261123.json');const a=json('cfsd-20261123/device-documentary-assessment.json');const c=json('cfsd-20261123/cadh31-source-variants.json');const chain=json('cfsd-20261123/notice-document-chain.json');
const m=buildManifest(cov,'CFSD_2025',a);assert.equal(m.devices.length,163);assert.equal(m.prepared_texts,161);assert.equal(m.certified_percent,0);assert.equal(m.certification_ready,false);assert.equal(m.blockers.length,4);
assert.deepEqual(m,json('cfsd-certification-manifest-20261123.json'));
const versions=new Map();for(const f of readdirSync(new URL('../evidence/',import.meta.url)).filter(f=>f.endsWith('.json'))){for(const v of json(f).versions||[])if(v.id)versions.set(v.id,v);}
for(const d of m.devices){const r=d.documentary_review;assert.equal(r.version_id,d.version_id);assert.equal(r.certified_for_notice,false);if(!d.version_id)continue;const v=versions.get(d.version_id);assert.ok(v);assert.equal(r.body_sha256,hash(v.body));assert.equal(r.source_extract_sha256,v.source_sha256);for(const day of['2024-05-09','2024-05-11']){assert.equal(r.scenario_checks[day],v.valid_from<=day&&(!v.valid_until||day<v.valid_until));assert.equal(r.scenario_checks[day],true);}}
assert.equal(m.devices.filter(d=>d.documentary_review.exact_start_requires_review).length,2);
assert.equal(hash(readFileSync(new URL('../evidence/'+c.brazilian_print_evidence.repository_artifact_path,import.meta.url))),c.brazilian_print_evidence.raw_sha256);
assert.equal(c.variants.length,2);for(const v of c.variants){assert.equal(hash(v.body),v.body_sha256);assert.equal(v.legal_version_id,null);assert.equal(v.chronological_amendment_claim,false);}
assert.ok(c.variants[0].body.includes('69 e 70'));assert.ok(c.variants[1].body.includes('76 e 77'));assert.equal(c.determinations.not_only_ocr_error,true);assert.equal(c.determinations.translation_origin_proven,false);assert.equal(c.prepared_version_id,null);
assert.equal(hash(read(c.brazilian_print_evidence.visual_transcript.path)),c.brazilian_print_evidence.visual_transcript.sha256);
assert.equal(chain.retrieved_documents.find(d=>d.url.includes('cloudfront')).pages,88);assert.equal(chain.retrieved_documents.find(d=>d.url.includes('qconcursos')).pages,93);assert.deepEqual(chain.acts_inspected.find(d=>d.kind==='Errata01').pdf_pages,[5]);
assert.equal(chain.official_full_publication_on,null);assert.equal(chain.cutoff_confirmed,false);assert.equal(chain.official_chain_complete,false);
for(const act of chain.acts_inspected){assert.equal(act.publication_on,null);assert.equal(hash(read(act.extract_path)),act.extract_sha256);assert.equal(act.changes_7_6_1_or_annexB_in_inspected_text,false);}
const forged=structuredClone(a);forged.formal_certification_count=1;assert.throws(()=>buildManifest(cov,'CFSD_2025',forged),/cannot promote/);
const wrong=structuredClone(a);wrong.devices[0].version_id='wrong';assert.throws(()=>buildManifest(cov,'CFSD_2025',wrong),/version mismatch/);
const missing=structuredClone(a);missing.devices.pop();assert.throws(()=>buildManifest(cov,'CFSD_2025',missing),/Incomplete/);
const stale=structuredClone(a);stale.coverage_sha256='0'.repeat(64);assert.throws(()=>buildManifest(cov,'CFSD_2025',stale),/another notice or coverage/);
console.log('PASS: 163 documentary states;161 source/body hashes and both candidate-date selections; printed conflict preserved; chain/extract hashes; 88/93-page locator corrected; no false notice or granular certification; stale/forged/version mismatch rejected');
