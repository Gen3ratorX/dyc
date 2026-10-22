// A loopback-only application host for local synthetic-data testing.
// This process is never deployed. Hosted authentication is unchanged.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
const project=fileURLToPath(new URL('..',import.meta.url));
const host='127.0.0.1',publicPort=3001,workerPort=8790;
const origin=`http://${host}:${publicPort}`,workerOrigin=`http://${host}:${workerPort}`;
const worker=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/state','--ip',host,'--inspector-port','0','--port',String(workerPort),'--var','APP_MODE:demo','--var','BOOTSTRAP_ADMIN_EMAIL:seedy@sites.test'],{cwd:project,stdio:['ignore','pipe','pipe']});
let ready=false,closing=false;
const server=http.createServer(async(req,res)=>{
  if(req.headers.host!==`${host}:${publicPort}`&&req.headers.host!==`localhost:${publicPort}`){res.writeHead(403);res.end('Local workspace only.');return;}
  if(req.headers.origin&&![origin,`http://localhost:${publicPort}`].includes(req.headers.origin)){res.writeHead(403);res.end('Cross-origin requests are not allowed.');return;}
  // Read hashed client assets directly so new builds stay available without
  // depending on the database worker's snapshot of the asset manifest.
  const pathname=new URL(req.url,origin).pathname;
  if(['GET','HEAD'].includes(req.method)&&(pathname.startsWith('/_next/static/')||['/sw.js','/favicon.svg'].includes(pathname))){
    const root=path.join(project,'dist/client');
    const asset=path.resolve(root,'.'+decodeURIComponent(pathname));
    if(asset.startsWith(root+path.sep)&&existsSync(asset)&&statSync(asset).isFile()){
      const extension=path.extname(asset),types={'.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.json':'application/json'};
      res.writeHead(200,{'Content-Type':types[extension]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      res.end(req.method==='HEAD'?undefined:readFileSync(asset));return;
    }
  }
  if(req.url?.startsWith('/signin-with-chatgpt')||req.url?.startsWith('/signout-with-chatgpt')){res.writeHead(302,{Location:'/'});res.end();return;}
  try{
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>1000000){res.writeHead(413);res.end('Request too large.');return;}chunks.push(chunk);}
    const headers={...req.headers};
    for(const key of Object.keys(headers))if(key.startsWith('oai-')||['host','connection','content-length','cookie','authorization','accept-encoding','x-forwarded-host','x-forwarded-proto'].includes(key))delete headers[key];
    headers['oai-authenticated-user-id']='local_seedy';headers['oai-authenticated-user-email']='seedy@sites.test';
    if(headers.origin)headers.origin=workerOrigin;
    const response=await fetch(workerOrigin+req.url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks),redirect:'manual'});
    const outgoing=Object.fromEntries(response.headers);delete outgoing['content-encoding'];delete outgoing['content-length'];delete outgoing['transfer-encoding'];
    res.writeHead(response.status,outgoing);res.end(Buffer.from(await response.arrayBuffer()));
  }catch(err){res.writeHead(503,{'Content-Type':'text/plain'});res.end('The local workspace is starting. Refresh shortly.');}
});
function shutdown(){if(closing)return;closing=true;server.close();worker.kill('SIGTERM');setTimeout(()=>process.exit(0),500).unref();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
worker.on('exit',code=>{if(!closing){console.error(`Local database worker stopped (${code}).`);server.close();process.exitCode=code||1;}});
server.on('error',error=>{console.error(error.message);shutdown();});
function output(chunk){const line=chunk.toString();if(line.includes('Ready on')&&!ready){ready=true;server.listen(publicPort,host,()=>console.log(`\nDYC Care is ready: ${origin}\nLocal demo session · synthetic data only\nRecords save to this Mac. Press Ctrl+C to stop.\n`));}if(/Error:|ERROR|error occurred|failed to/i.test(line))process.stderr.write(line);}
worker.stdout.on('data',output);worker.stderr.on('data',output);
