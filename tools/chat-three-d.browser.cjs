const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert/strict'), crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const jobId = 'a'.repeat(32), artifact = Buffer.from('glTF-fixture-download');
const server = http.createServer((req,res)=>{ const name = decodeURIComponent(req.url.split('?')[0]); const file=path.join(root,name==='/'?'chat.html':name); try {res.setHeader('Content-Type',file.endsWith('.mjs')||file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end('missing');} });
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1365,height:900},acceptDownloads:true});
 const calls=[],errors=[];let jobs=[],available=true;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url());calls.push({path:url.pathname,method:req.method(),body:req.postData(),headers:req.headers()});
  let data={ok:true};
  if(url.pathname.startsWith('/api/private/3d')){
   if(url.pathname.endsWith('/health'))data={available};
   else if(url.pathname.endsWith('/content'))return route.fulfill({status:200,body:artifact,contentType:'model/gltf-binary'});
   else if(url.pathname.endsWith('/cancel')){jobs[0]={...jobs[0],status:'CANCELLED'};data={job:jobs[0]};}
   else if(url.pathname.endsWith('/generations')){
    if(req.method()==='POST'){jobs=[{id:jobId,status:'IN_QUEUE',stage:'queue',seed:7}];data={job:jobs[0]};}
    else data={jobs};
   } else {jobs[0]={...jobs[0],status:'FAILED',stage:'export',error:'STL export failed',artifacts:{glb:{bytes:artifact.length,sha256:crypto.createHash('sha256').update(artifact).digest('hex')}}};data={job:jobs[0]};}
  } else if(url.pathname.endsWith('/chat/models'))data={ok:true,models:[{id:'fixture-model',name:'Fixture model'}],default_model:'fixture-model'};
  else if(url.pathname.endsWith('/conversations'))data={ok:true,conversations:[]};
  else if(url.pathname.endsWith('/projects'))data={ok:true,projects:[]};
  else if(url.pathname.endsWith('/jobs'))data={ok:true,jobs:[]};
  await route.fulfill({status:200,json:data});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/chat.html#3d`);
 await page.getByText('TRELLIS.2 is ready for image-to-3D generation.').waitFor();
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=8;c.height=8;const x=c.getContext('2d');x.fillStyle='#0f0';x.fillRect(2,2,4,4);return c.toDataURL().split(',')[1];});
 await page.locator('[name=image]').setInputFiles({name:'prop.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await page.getByRole('button',{name:'Generate model',exact:true}).click();
 await page.getByRole('button',{name:'Download GLB'}).waitFor();
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download GLB'}).click();
 const download=await downloadEvent;assert.equal(download.suggestedFilename(),`token-gen-${jobId}.glb`);
 const retryResponse=page.waitForResponse(r=>r.url().endsWith('/api/private/3d/generations')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Generate model',exact:true}).click(); await retryResponse;
 await page.getByRole('button',{name:'Download GLB'}).waitFor();
 const posts=calls.filter(x=>x.path==='/api/private/3d/generations'&&x.method==='POST');
 assert.equal(posts.length,2);assert.equal(posts[0].headers['idempotency-key'],posts[1].headers['idempotency-key']);assert.equal(posts[0].body,posts[1].body);
 assert(calls.some(x=>x.path===`/api/private/3d/generations/${jobId}`&&x.method==='GET'));
 if(process.env.THREE_D_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.THREE_D_SCREENSHOT_DIR,'three-d-desktop.png')});
 await page.getByRole('button',{name:'Close 3D models'}).click();
 await page.locator('[data-chat-mode=chat]').click();assert.equal(await page.locator('#chatMode').inputValue(),'chat');
 await page.setViewportSize({width:390,height:844});available=false;
 await page.getByRole('button',{name:'Open 3D models',exact:true}).click();
 await page.getByText('3D generation is currently unavailable. You can still view saved models.').waitFor();
 assert(await page.getByRole('button',{name:'Generate model',exact:true}).isDisabled());
 assert(await page.getByRole('button',{name:'Download GLB'}).isEnabled());
 assert(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.querySelector('dialog').clientWidth));
 if(process.env.THREE_D_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.THREE_D_SCREENSHOT_DIR,'three-d-mobile.png')});
 await page.keyboard.press('Escape');assert.equal(await page.locator('dialog.three-d-dialog').evaluate(x=>x.open),false);
 assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({ok:true,scenarios:2,posts:posts.length,download:download.suggestedFilename(),desktop:'1365x900',mobile:'390x844'}));
 await browser.close();server.close();
})().catch(e=>{console.error(e);server.close();process.exit(1);});
