from pathlib import Path
import argparse,json,subprocess
P=Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description='Build or verify the standalone audited SNDK model.')
parser.add_argument('--check',action='store_true')
args=parser.parse_args()
m=json.loads((P/'model.json').read_text())
html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SNDK Value Lab 2.0</title><style>'+((P/'source/style.css').read_text()+(P.parent/'market/quotes.css').read_text())+'</style></head><body><main>'+(P/'source/template.html').read_text()+'</main>'
for s in ['const MODEL='+json.dumps(m)+';',(P/'source/engine.js').read_text(),(P.parent/'market/quotes.js').read_text(),(P/'source/app.js').read_text()]:html+='<script>'+s.replace('</script','<\\/script')+'</script>'
results=subprocess.check_output(['node','-e',"const E=require('./source/engine.js'),m=require('./model.json');process.stdout.write(JSON.stringify(E.all(m),null,2)+'\\n');"],cwd=P)
for name,data in {'sndk_valuation_v2_0.html':(html+'</body></html>').encode('utf-8'),'default_results.json':results}.items():
 if args.check:
  assert (P/name).read_bytes()==data,'Stale generated file: '+name
 else:
  (P/name).write_bytes(data)
print('PASS v2.0 generated files match source' if args.check else 'Built standalone SNDK v2.0 HTML and results')
