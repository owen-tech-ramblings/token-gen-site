const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('http'), fs = require('fs'), path = require('path'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  try {
    res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(fs.readFileSync(file));
  } catch { res.statusCode = 404; res.end('missing'); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless:true});
  try {
    for (const viewport of [{width:1365,height:900}, {width:390,height:844}]) {
      const page = await browser.newPage({viewport});
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const requests = [];
      const saved = {id:'saved-warriors',title:'Saved Warriors schedule',retention:'30_days',version:1,messages:[
        {role:'user',content:'What are the Warriors first five games?'},
        {role:'assistant',content:'The saved schedule uses US ET.',web_context:{query:'Warriors opening five schedule',sources:[
          {index:1,title:'Official saved schedule',url:'https://www.nba.com/warriors/schedule'},
        ]}},
      ]};
      await page.route('**/api/**', async route => {
        const pathname = new URL(route.request().url()).pathname;
        let data = {ok:true};
        if (pathname.endsWith('/chat/models')) data = {ok:true,data:{data:[{id:'fixture-model',name:'Fixture model'}]},default_model:'fixture-model'};
        else if (pathname.endsWith('/web-search/health')) data = {ok:true,data:{available:true,default_enabled:true,research_available:true,unmetered_available:true,fetch_modes:{direct:true}}};
        else if (pathname.endsWith('/conversations')) data = {ok:true,conversations:[saved],preferences:{retention:'none'}};
        else if (pathname.endsWith('/conversations/saved-warriors')) data = {ok:true,conversation:saved};
        else if (pathname.endsWith('/projects')) data = {ok:true,projects:[]};
        else if (pathname.endsWith('/jobs')) data = {ok:true,jobs:[]};
        else if (pathname.endsWith('/chat/stream')) {
          requests.push(route.request().postDataJSON());
          const context = {provider:'searxng',fetch_mode:'direct',query:'Warriors schedule',research:{enabled:true,pages_with_full_text:2,chunks_selected:30,locally_compacted:true},sources:[
            {index:1,title:'Official schedule',url:'https://www.nba.com/team/1610612744/warriors/schedule',fetched:true,extraction_method:'trafilatura',content_coverage:'complete'},
            {index:2,title:'Schedule details',url:'https://example.com/details',fetched:true,content_coverage:'partial'},
            {index:3,title:'Search preview',url:'https://example.com/preview',fetched:false,content_coverage:'snippet_only'},
          ],warnings:['The unmetered balanced SearXNG service performed the search directly.','Local embedding was unavailable; research evidence used lexical ranking.','[3] The page could not be read; only its search snippet is available.']};
          const events = [{type:'web_context',data:context},{choices:[{delta:{content:'The opening schedule is available here [1].'},finish_reason:'stop'}]}];
          return route.fulfill({status:200,contentType:'text/event-stream',body:events.map(event=>'data: '+JSON.stringify(event)+'\n\n').join('')+'data: [DONE]\n\n'});
        }
        await route.fulfill({status:200,json:data});
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/chat.html`);
      await page.waitForFunction(() => !document.querySelector('#chatSend').disabled);
      await page.locator('#chatInput').fill('What are the first five Warriors games this NBA season?');
      await page.locator('#chatSend').click();
      const sources = page.locator('.chat-web-context');
      await sources.locator('summary').waitFor();
      await sources.locator('summary').click();
      const text = await sources.innerText();
      assert.match(text, /Page read/); assert.match(text, /Excerpt used/); assert.match(text, /Search preview only/);
      assert.match(text, /Some pages could not be opened/);
      assert.doesNotMatch(text, /SearXNG|unmetered|trafilatura|ranked|compacted|lexical|direct/i);
      assert.equal(await sources.locator('a').first().getAttribute('href'), 'https://www.nba.com/team/1610612744/warriors/schedule');
      assert.equal(await page.locator('#chatWebStatus').textContent(), 'Web search is available.');
      await page.waitForFunction(() => !document.querySelector('#chatSend').disabled);
      await page.locator('#chatInput').fill('Convert the times from US ET to AUS Syd time zone.');
      await page.locator('#chatSend').click();
      await page.waitForFunction(() => !document.querySelector('#chatSend').disabled);
      assert.equal(requests.length, 2);
      const previousAnswer = requests[1].messages.find(message => message.role === 'assistant');
      assert.equal(previousAnswer.web_context?.query, 'Warriors schedule');
      assert.equal(previousAnswer.web_context.sources[0].url, 'https://www.nba.com/team/1610612744/warriors/schedule');
      assert.equal(previousAnswer.content, 'The opening schedule is available here [1].');
      assert.equal(requests[1].messages.filter(message => message.role === 'user').at(-1).content,
        'Convert the times from US ET to AUS Syd time zone.');
      if (await page.locator('#chatRailOpen').isVisible()) await page.locator('#chatRailOpen').click();
      await page.locator('[data-history-open="saved-warriors"]').click();
      await page.getByText('The saved schedule uses US ET.', {exact:true}).waitFor();
      await page.locator('#chatInput').fill('Show them in Sydney time.');
      await page.locator('#chatSend').click();
      await page.waitForFunction(() => !document.querySelector('#chatSend').disabled);
      assert.equal(requests.length, 3);
      const restoredAnswer = requests[2].messages.find(message => message.role === 'assistant');
      assert.equal(restoredAnswer.web_context.query, 'Warriors opening five schedule');
      assert.equal(restoredAnswer.web_context.sources[0].url, 'https://www.nba.com/warriors/schedule');
      assert.deepEqual(errors, []);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      console.log(`Public sources passed at ${viewport.width}x${viewport.height}`);
      await page.close();
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode=1; });
