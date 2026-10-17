import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../chat.js',import.meta.url),'utf8');
function harness(id='flux3-image-klein') {
  const elements = Object.fromEntries(['imageSize','imageOrientation','imageQuality','imageSampler','imageScheduler','imageEditStrength','imageStatus'].map(key=>[key,{value:key==='imageSize'?'native':key==='imageQuality'?'ultra':'',dataset:{},options:[],closest:()=>({hidden:false})}]));
  const catalog={current:{id,available:true,recommended_defaults:{width:id.startsWith('flux3')?4096:2048}},controls:{quality_presets:{ultra:{size:4096},draft:{size:1024}}}};
  const context=vm.createContext({els:elements,imageModelCatalog:catalog,imageGenerationSupported:false,activeImageMask:null,Date,Math,Number,Boolean,Error,API_BASE:'https://example.test',fetch:async()=>({ok:true,json:async()=>catalog}),syncImageSizeControls(){},updateSendState(){},getMode:()=> 'image',setStatus(){},clampNumber:(v,f,min,max)=>Math.max(min,Math.min(max,Number(v)||f)),buildStyledImagePrompt:p=>p,imageNegativePrompt:()=> 'legacy negatives',prepareImageSourceForEdit:async s=>({image_base64:s.bytes}),loadImageElement:async()=>({naturalWidth:600,naturalHeight:400})});
  for(const name of ['isFlux3ImageModel','imageDimensions','loadImageCapability','imageRequestForModel','buildImagePayload','buildImageEditPayload']) {
    const code=source.match(new RegExp('(?:async )?function '+name+'\\([^]*?\\n}'));
    assert.ok(code,`missing ${name}`); vm.runInContext(code[0],context);
  }
  return context;
}
test('FLUX 3 discovery selects native 4K and sends only supported generation controls', async()=>{
  const c=harness(); await c.loadImageCapability(); assert.equal(c.imageGenerationSupported,true);
  let dimensions=c.imageDimensions(); assert.equal(dimensions.width,4096); assert.equal(dimensions.height,4096);
  const settings={...dimensions,qualityKey:'ultra',creativity:.5,contentRating:'standard',samplerName:'res_multistep',scheduler:'sgm_uniform'};
  let payload=c.buildImagePayload('hoverboard racer',settings,0);
  assert.equal(payload.width,4096);assert.equal(payload.prompt_upsampling,true);
  for(const key of ['negative_prompt','creativity','sampler_name','scheduler','content_rating'])assert.equal(key in payload,false,key);
  c.els.imageSize.value='1024';c.els.imageOrientation.value='landscape'; dimensions=c.imageDimensions();
  payload=c.buildImagePayload('racer',{...settings,...dimensions,qualityKey:'draft'},0);
  assert.equal(payload.width,1024);assert.equal(payload.height,768);assert.equal(payload.quality,'draft');
  const legacy=harness('flux2-klein-9b');assert.equal(legacy.buildImagePayload('racer',settings,0).negative_prompt,'legacy negatives');
});
test('FLUX 3 edits preserve original bytes, source aspect and masked output contract',async()=>{
  const c=harness();const settings={qualityKey:'ultra',editStrength:.2,preservation:'strict',creativity:.5,samplerName:'res_multistep',scheduler:'sgm_uniform'};
  for(const mode of ['edit','restyle','style']) {
    const payload=await c.buildImageEditPayload('make board blue',settings,0,{bytes:'original transparent PNG'},mode);
    assert.equal(payload.image_base64,'original transparent PNG');assert.equal(payload.width,4096);assert.equal(payload.height,2736);
    for(const key of ['negative_prompt','strength','denoise','creativity','preservation'])assert.equal(key in payload,false,key);
  }
  c.activeImageMask={bytes:'original mask PNG'};
  const masked=await c.buildImageEditPayload('board blue',settings,0,{bytes:'original PNG'},'edit');
  assert.equal(masked.mask_base64,'original mask PNG');assert.equal(masked.preserve_unmasked,true);
});
