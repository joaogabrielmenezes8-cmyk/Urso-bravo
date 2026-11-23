"""Prepare literal unchanged article states from captured official HTML only.
Requires lxml; accepts local source directory and writes only local evidence files.
No database connection, certification, or production operation.
"""
from lxml import html,etree
from pathlib import Path
import re,json

source_dir='.'

def textlines(f,original=False):
 root=html.fromstring(Path(source_dir+'/'+f+'.html').read_bytes())
 if not original:
  return [' '.join(e.text_content().split()) for e in root.xpath('//body/p|//body/h1|//body/h2|//body/h3|//body/h4') if e.text_content().strip()]
 if original: root=root.xpath('//div[@class="textoNorma"]')[0]
 for e in root.xpath('.//script|.//style|.//img'):e.drop_tree()
 # Preserve visible words and boundaries; line wrapping is normalized to spaces.
 for e in root.xpath('.//br'):e.tail='\n'+(e.tail or '')
 for e in root.xpath('.//p|.//h1|.//h2|.//h3|.//h4|.//center'):
  e.text='\n'+(e.text or '');e.tail='\n'+(e.tail or '')
 return [' '.join(s.split()) for s in root.text_content().splitlines() if s.strip()]

def parse(f,original=False):
 lines=textlines(f,original);arts={};meta={};k=None;heading=False
 for line in lines:
  if line.startswith('Brasília,'):break
  m=re.match(r'Art\.\s*(\d+)(?:[º°o.]|\s)?(?:-([A-Z]))?[.\s]*(.*)$',line)
  if m:
   k=m[1]+('-'+m[2] if m[2] else '');arts[k]=[m[3]];meta[k]=[];heading=False
  elif re.match(r'^(?:CAPÍTULO|Seção|SEÇÃO|Subseção|SUBSEÇÃO)\b',line):k=None;heading=True
  elif k:arts[k].append(line)
 return {k:'\n\n'.join(v) for k,v in arts.items()}

if __name__=='__main__':
 import argparse,csv,hashlib,uuid,datetime
 parser=argparse.ArgumentParser();parser.add_argument('--source-dir',required=True);parser.add_argument('--evidence-dir',required=True);parser.add_argument('--law',choices=['L9099','L9605'],required=True)
 args=parser.parse_args();source_dir=args.source_dir;out=Path(args.evidence_dir);code=args.law;prefix=code.lower()
 slug={'L9099':'1995/lei-9099-26-setembro-1995-348608','L9605':'1998/lei-9605-12-fevereiro-1998-365397'}[code]
 base='https://www2.camara.leg.br/legin/fed/lei/'+slug
 currentfile=prefix+('-official' if code=='L9099' else '-current')
 original=parse(prefix+'-original',True);current=parse(currentfile)
 expected={'L9099':99,'L9605':87}[code]
 if len(current)!=expected:raise ValueError('Unexpected official article enumeration')
 publication={'L9099':'1995-09-27','L9605':'1998-02-13'}[code]
 days={'L9099':60,'L9605':45}[code]
 start=(datetime.date.fromisoformat(publication)+datetime.timedelta(days=days)).isoformat()
 basis={'L9099':'Art.96: sessenta dias após publicação oficial de 27/09/1995. Resultado aritmético 26/11/1995; não data da assinatura.', 'L9605':'Art.81 integralmente vetado; regra subsidiária do art.1º LINDB (45 dias), publicação DOU 13/02/1998. Resultado 30/03/1998. Retificação DOU17/02/1998 corrige somente epígrafe, sem substituir corpo dos artigos; não tratada como redação legislativa nova.'}[code]
 rows=list(csv.DictReader(open(out/'p0-cfo-explicit-catalog.tsv'),delimiter='\t'));canon={r['provision_key']:r['provision_id'] for r in rows if r['document_code']==code}
 bundle={'document_code':code,'reviewed_on':'2026-11-23','candidate_cutoff':'2026-09-03','notice_certification':False,'source_url':base+'-normaatualizada-pl.html','source_extract':prefix+'-originais-20261123.txt','valid_from_basis':basis,'publication_on':publication,'vacatio_days':days,'source_captures':[],'versions':[],'scope_preparation':[],'not_prepared':[],'preparation_limits':'Redações literais comparadas entre publicação original e compilação oficial. Não certifica todo o histórico intermediário, interpretação jurisprudencial, cadeia do edital ou todas as normas correlatas. Nenhuma redação alterada foi inferida.'}
 captures=[(prefix+'-original',base+'-publicacaooriginal-1-pl.html'),(currentfile,base+'-normaatualizada-pl.html'),(prefix+'-meta',base+'-norma-pl.html')]
 if code=='L9605':captures.append((prefix+'-retificacao',base+'-retificacao-172836-pl.html'))
 for name,url in captures:
  raw=Path(source_dir+'/'+name+'.html').read_bytes();bundle['source_captures'].append({'url':url,'captured_on':'2026-11-23','raw_sha256':hashlib.sha256(raw).hexdigest(),'raw_bytes':len(raw)})
 for kind,articles in [('original',original),('compilada',current)]:
  archive='\n\n'.join(f'Art. {k}.\n{v}' for k,v in articles.items())+'\n';filename=prefix+'-fonte-'+kind+'-20261123.txt';(out/filename).write_text(archive);bundle[kind+'_archive']={'path':filename,'sha256':hashlib.sha256(archive.encode()).hexdigest()}
 extracts=[]
 for k,body in current.items():
  key='art-'+k.split('-')[0].zfill(5)+('-'+k.split('-')[1].lower() if '-'in k else '')
  if key not in canon:raise ValueError('Unmapped canonical article '+key)
  original_body=original.get(k)
  if body.upper()=='(VETADO)':status='not_enacted_veto'
  elif code=='L9099' and k=='85':status='pending_derogation_and_jurisprudence_review'
  elif original_body is None or ' '.join(body.split())!=' '.join(original_body.split()):status='pending_amendment_or_source_difference_review'
  else:status='prepared_official_text'
  if status!='prepared_official_text':bundle['not_prepared'].append({'provision_key':key,'provision_id':canon[key],'status':status});continue
  body=body.strip();extract=f'Art. {k}.\n{body}\n';digest=hashlib.sha256(extract.encode()).hexdigest();vid=str(uuid.uuid5(uuid.NAMESPACE_URL,f'{base}#{key}:{start}:{digest}'))
  bundle['versions'].append({'id':vid,'provision_id':canon[key],'valid_from':start,'valid_until':None,'heading':None,'body':body,'revoked':False,'source_url':bundle['source_url'],'source_sha256':digest,'review_evidence':basis+' Comparação literal original/compilação após normalização apenas de espaços e quebras de linha; não se alteraram palavras, números, pontuação ou vetos parciais. Estado preparado para o corte candidato, sem certificação formal por edital.'})
  bundle['scope_preparation'].append({'article':k,'provision_key':key,'provision_id':canon[key],'version_id':vid,'source_sha256':digest,'status':status,'original_matches_compilation':True});extracts.append(extract)
 bundle['prepared_devices']=len(bundle['versions']);bundle['identified_slots']=expected
 (out/bundle['source_extract']).write_text('\n'.join(extracts));(out/(prefix+'-originais-20261123.json')).write_text(json.dumps(bundle,ensure_ascii=False,indent=2)+'\n')
 print(code,bundle['prepared_devices'],'prepared;',len(bundle['not_prepared']),'explicitly not prepared; starts',start)
