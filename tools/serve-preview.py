"""Local-only development preview with manuals hosted outside the PWA package."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import sys
repo=Path(__file__).resolve().parents[1]
class Preview(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(repo/'PWA'),**kwargs)
 def do_GET(self):
  path=self.path.split('?',1)[0]
  if path in ['/', '/index.html']:
   source=(repo/'PWA/index.html').read_text().replace('<body>', '<body><script>window.S2AManualBase="./manual/";</script>',1).encode()
   self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(source)));self.end_headers();self.wfile.write(source)
  elif path.startswith('/manual/'):
   filename=path[len('/manual/'):]
   allowed={f'S2A-Pilot-et-Bridge-{lang}.pdf' for lang in ['fr','en','es','de']}
   if filename not in allowed:self.send_error(404);return
   source=(repo/'docs/manual'/filename).read_bytes();self.send_response(200);self.send_header('Content-Type','application/pdf');self.send_header('Content-Length',str(len(source)));self.end_headers();self.wfile.write(source)
  else:super().do_GET()
ThreadingHTTPServer(('127.0.0.1',int(sys.argv[1]) if len(sys.argv)>1 else 8907),Preview).serve_forever()
