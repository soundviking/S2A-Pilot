const http=require('http'),crypto=require('crypto');
const key=crypto.randomBytes(24).toString('hex'),expires=Date.now()+4*3600000;
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 const cookie=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('s2a-demo='));
 const entry=u.searchParams.get('demo');
 if(Date.now()>expires||(entry!==key&&cookie!=='s2a-demo='+key)){res.writeHead(404,{'Cache-Control':'no-store'});res.end('Lien de demonstration absent ou expire.');return;}
 if(entry===key)res.setHeader('Set-Cookie','s2a-demo='+key+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=14400');
 const proxy=http.request({hostname:'127.0.0.1',port:Number(process.env.UPSTREAM_PORT),path:req.url,method:req.method,headers:req.headers},up=>{
 const headers={...up.headers,'referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow'};
 res.writeHead(up.statusCode,headers);up.pipe(res);
 });proxy.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Demonstration momentanement indisponible.');});req.pipe(proxy);req.on('aborted',()=>proxy.destroy());res.on('close',()=>proxy.destroy());
}).listen(Number(process.env.PORT),'127.0.0.1',()=>console.log('DEMO_ENTRY_QUERY=demo='+key));
