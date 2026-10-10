// Local signaling only. No production Pilot code or transport commands are exposed.
const http=require('http'),https=require('https'),fs=require('fs'),path=require('path'),crypto=require('crypto'),os=require('os');
const root=__dirname,sessions=new Map(),port=Number(process.env.PORT||8098),host=process.env.HOST||'127.0.0.1';
const token=()=>crypto.randomBytes(24).toString('hex');
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function emit(stream,data){if(stream&&!stream.destroyed)stream.write('data: '+JSON.stringify(data)+'\n\n');}
async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>65536)throw Error('Message trop volumineux');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');}
function credentials(url){const session=sessions.get(url.searchParams.get('session'));if(!session||session.expires<Date.now())return null;const key=url.searchParams.get('key');if(key===session.hostKey)return {session,role:'host'};const peer=session.peers.get(url.searchParams.get('peer'));if(peer&&key===peer.key)return {session,peer,role:'viewer'};return null;}
async function handle(req,res){try{
 const url=new URL(req.url,'http://localhost');
 if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'Origine refusée'});
 if(req.method==='POST'&&url.pathname==='/api/sessions'){
  if(sessions.size>=20)return json(res,429,{error:'Trop de sessions'});
  const id=token(),session={id,hostKey:token(),viewKey:token(),expires:Date.now()+21600000,peers:new Map(),stream:null};sessions.set(id,session);return json(res,201,{id,hostKey:session.hostKey,viewKey:session.viewKey});
 }
 if(req.method==='POST'&&url.pathname==='/api/join'){
  const data=await body(req),session=sessions.get(data.session);
  if(!session||session.viewKey!==data.key||session.expires<Date.now())return json(res,403,{error:'Appairage expiré ou incorrect'});
  if(session.peers.size>=32)return json(res,429,{error:'Session complète'});
  const peer={id:token(),key:token(),stream:null,lastSeen:Date.now()};session.peers.set(peer.id,peer);return json(res,201,{id:peer.id,key:peer.key});
 }
 if(url.pathname.startsWith('/api/')){
  const auth=credentials(url);if(!auth)return json(res,403,{error:'Accès refusé'});
  const {session,peer,role}=auth;
  if(req.method==='GET'&&url.pathname==='/api/events'){
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});res.write('retry: 1200\n\n');
   if(role==='host'){if(session.stream)session.stream.end();session.stream=res;for(const p of session.peers.values())if(p.stream)emit(res,{type:'join',peer:p.id});}
   else{if(peer.stream)peer.stream.end();peer.stream=res;peer.lastSeen=Date.now();emit(session.stream,{type:'join',peer:peer.id});}
   const beat=setInterval(()=>{res.write(': heartbeat\n\n');if(peer)peer.lastSeen=Date.now();},10000);
   req.on('close',()=>{clearInterval(beat);if(role==='host'&&session.stream===res)session.stream=null;if(peer&&peer.stream===res){peer.stream=null;peer.lastSeen=Date.now();}});return;
  }
  if(req.method==='POST'&&url.pathname==='/api/signal'){
   const data=await body(req),allowed=role==='host'?['offer','ice']:['answer','ice'];
   if(!allowed.includes(data.type))return json(res,400,{error:'Signal non autorisé'});
   if(role==='host'){const target=session.peers.get(data.peer);if(!target)return json(res,404,{error:'Compagnon absent'});emit(target.stream,{type:data.type,value:data.value});}
   else{peer.lastSeen=Date.now();emit(session.stream,{type:data.type,peer:peer.id,value:data.value});}
   return json(res,200,{ok:true});
  }
  return json(res,404,{error:'Route inconnue'});
 }
 if(req.method!=='GET')return json(res,405,{error:'Méthode refusée'});
 const files={'/':'index.html','/copilot':'copilot.html','/app.js':'app.js','/style.css':'style.css','/vendor/qrcode.js':'vendor/qrcode.js'};
 const file=files[url.pathname];if(!file)return json(res,404,{error:'Page inconnue'});
 res.writeHead(200,{'Content-Type':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});fs.createReadStream(path.join(root,file)).pipe(res);
 }catch(e){if(!res.headersSent)json(res,400,{error:e.message});else res.end();}}
setInterval(()=>{for(const [id,s] of sessions){if(s.expires<Date.now()){s.stream?.end();for(const p of s.peers.values())p.stream?.end();sessions.delete(id);continue;}for(const [pid,p]of s.peers)if(!p.stream&&Date.now()-p.lastSeen>120000)s.peers.delete(pid);}},30000).unref();
const tls=process.env.TLS_CERT&&process.env.TLS_KEY,server=tls?https.createServer({cert:fs.readFileSync(process.env.TLS_CERT),key:fs.readFileSync(process.env.TLS_KEY)},handle):http.createServer(handle);
server.listen(port,host,()=>{const scheme=tls?'https':'http';console.log(`S2A Pilot TEST : ${scheme}://localhost:${port}`);if(host==='0.0.0.0')for(const interfaces of Object.values(os.networkInterfaces()))for(const address of interfaces||[])if(address.family==='IPv4'&&!address.internal)console.log(`Wi-Fi local : ${scheme}://${address.address}:${port}`);console.log('Prototype isolé. Pour iPhone/iPad, utiliser HTTPS avec un certificat approuvé.');});
