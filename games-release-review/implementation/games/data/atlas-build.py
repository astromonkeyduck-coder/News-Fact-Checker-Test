import json,math,hashlib,datetime,collections,shutil
from pathlib import Path
import argparse
parser=argparse.ArgumentParser(description='Rebuild frozen Atlas data from downloaded primary sources; no network or live writes.')
parser.add_argument('--geometry',required=True,help='Downloaded Natural Earth v5.1.2 50m countries GeoJSON')
parser.add_argument('--population',default=str(Path(__file__).parent/'atlas-population-source.json'))
parser.add_argument('--metadata',default=str(Path(__file__).parent/'atlas-country-metadata.json'))
parser.add_argument('--output',default=str(Path(__file__).parent))
args=parser.parse_args();root=Path(args.output);root.mkdir(parents=True,exist_ok=True)
for source,expected in [(args.population,'adabba898d02d1e24eb749ce161fcba2d8567bfe4ecb493de5648370cff8439a'),(args.metadata,'d29d57f8adf954c5e2a1520a02fb2c7b45575d8db3bd327a9dff47d66914231c'),(args.geometry,'3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb')]:
 assert hashlib.sha256(Path(source).read_bytes()).hexdigest()==expected, 'Source bytes differ from the frozen edition: explicitly review and version any source change'
p=json.load(open(args.population));meta=json.load(open(args.metadata));geo=json.load(open(args.geometry))
assert p[0]['lastupdated']=='2026-07-13', 'New source edition: update content version and documentation before rebuilding'
assert all(row['date']=='2024' for row in p[1]), 'Mixed or changed reference year'
cm={x['id']:x for x in meta[1] if x['region']['id']!='NA'}
def gid(f):
 a=f['properties'];return a['ISO_A3_EH'] if a['ISO_A3_EH']!='-99' else a['ADM0_A3']
gm={gid(f):f for f in geo['features']}
eligible={gid(f) for f in geo['features'] if f['properties']['TYPE'] in ['Sovereign country','Country']}
rows=sorted([x for x in p[1] if x['value'] is not None and x['countryiso3code'] in cm and x['countryiso3code'] in eligible],key=lambda x:(-x['value'],x['countryiso3code']))
assert len(rows)>=50
aliases={'USA':['United States','United States of America','US','USA','U.S.A.'],'GBR':['United Kingdom','UK','U.K.'],'RUS':['Russia','Russian Federation'],'TUR':['Türkiye','Turkiye','Turkey'],'VNM':['Vietnam','Viet Nam'],'COD':['Democratic Republic of the Congo','Democratic Republic of Congo','DR Congo','DRC','Congo-Kinshasa'],'KOR':['South Korea','Republic of Korea'],'IRN':['Iran','Islamic Republic of Iran'],'EGY':['Egypt','Arab Republic of Egypt'],'CIV':["Côte d’Ivoire","Cote d'Ivoire",'Ivory Coast'],'TZA':['Tanzania','United Republic of Tanzania'],'MMR':['Myanmar','Burma']}
names={'COD':'Democratic Republic of the Congo','KOR':'South Korea','CIV':'Côte d’Ivoire','TUR':'Türkiye','VNM':'Vietnam','RUS':'Russia','EGY':'Egypt','IRN':'Iran','YEM':'Yemen'}
features=[];edges=collections.defaultdict(set)
for f in geo['features']:
 id=gid(f);a=f['properties'];polys=f['geometry']['coordinates'] if f['geometry']['type']=='MultiPolygon' else [f['geometry']['coordinates']]
 for poly in polys:
  for ring in poly:
   for u,v in zip(ring,ring[1:]):
    u=tuple(round(n,5) for n in u);v=tuple(round(n,5) for n in v)
    if u!=v:edges[tuple(sorted((u,v)))].add(id)
 def rounds(x):return [round(v,3) for v in x] if isinstance(x[0],(int,float)) else [rounds(v) for v in x]
 features.append({'id':id,'name':names.get(id,a['NAME_EN'] or a['ADMIN']),'type':a['TYPE'],'geometry':{'type':f['geometry']['type'],'coordinates':rounds(f['geometry']['coordinates'])}})
neighbors=collections.defaultdict(set)
for ids in edges.values():
 if len(ids)>1:
  for id in ids:neighbors[id].update(ids-{id})
cs=[]
for rank,r in enumerate(rows[:50],1):
 id=r['countryiso3code'];a=gm[id]['properties'];name=names.get(id,cm[id]['name']);lst=sorted(neighbors[id]);fct='Mapped land neighbors include '+', '.join(names.get(n,gm[n]['properties']['NAME_EN']) for n in lst[:4])+'.' if lst else 'No shared land boundary is represented for this country in this map edition.'
 cs.append({'id':id,'name':name,'aliases':list(dict.fromkeys([name]+aliases.get(id,[]))),'population':r['value'],'populationYear':2024,'rank':rank,'region':a['SUBREGION'],'continent':a['CONTINENT'],'label':[a['LABEL_X'],a['LABEL_Y']],'neighbors':lst,'fact':fct,'populationUrl':'https://data.worldbank.org/indicator/SP.POP.TOTL?locations='+cm[id]['iso2Code'],'mapUrl':'https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/','eligibleType':a['TYPE']})
D={'version':'atlas-wdi2024-20260713-ne512-v1','schemaVersion':1,'referenceYear':2024,'populationEdition':'World Development Indicators, source 2; last updated 2026-07-13; reference year 2024','retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'populationSource':'https://data.worldbank.org/indicator/SP.POP.TOTL','populationLicense':'CC BY 4.0; World Bank and source providers','geometryEdition':'Natural Earth 1:50m Admin 0 Countries, v5.1.2','geometryLicense':'Public domain; Made with Natural Earth','inclusionPolicy':'Rank numeric 2024 WDI population records after excluding World Bank aggregate rows, then retain country identities classified Sovereign country or Country in this Natural Earth edition. Dependencies, disputed and indeterminate map units are excluded. Take the first 50 by descending population; ISO3 breaks a tie. This is a documented game inclusion rule, not a political judgment.','boundaryNote':'Natural Earth shows de facto boundaries and separates some territories. Map conventions are not a statement about legal sovereignty. World Bank population coverage may differ from displayed administrative geometry, including overseas areas.','countries':cs,'features':features,'selectionAudit':{'eligibleCount':len(rows),'selectedIds':[r['countryiso3code'] for r in rows[:50]],'nextFive':[{ 'id':r['countryiso3code'],'population':r['value']} for r in rows[50:55]]},'editorialReview':'publisher-review-pending'}
text=json.dumps(D,ensure_ascii=False,separators=(',',':'))
(root/'atlas-data.json').write_text(text+'\n');(root/'atlas-data.js').write_text('(function(r){var d='+text+';if(typeof module===\"object\"&&module.exports)module.exports=d;else r.NoteworthyAtlasData=d;})(typeof window===\"object\"?window:this);\n')
manifest={'version':D['version'],'populationReferenceYear':2024,'populationLastUpdated':p[0]['lastupdated'],'inclusionPolicy':D['inclusionPolicy'],'geometry':'Natural Earth 50m admin0 v5.1.2, public domain; coordinates rounded to 0.001 degrees; polygon rings, holes and multipolygons retained. Border-neighbor hints derived from shared source edges, not guessed.','sources':[]}
for src,name,url in [(args.population,'atlas-population-source.json','https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?date=2024&format=json&per_page=400'),(args.metadata,'atlas-country-metadata.json','https://api.worldbank.org/v2/country?format=json&per_page=400'),(args.geometry,None,'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson')]:
 file=Path(src);b=file.read_bytes();manifest['sources'].append({'file':name,'url':url,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'retrievedAt':datetime.datetime.fromtimestamp(file.stat().st_mtime,datetime.timezone.utc).isoformat()})
 if name and file.resolve()!=(root/name).resolve():shutil.copyfile(file,root/name)
manifest['datasetSha256']=hashlib.sha256((root/'atlas-data.json').read_bytes()).hexdigest();(root/'atlas-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Data bytes',len(text.encode()),'countries',len(cs),'features',len(features),'eligible',len(rows));print([(c['id'],c['neighbors']) for c in cs[:10]])
