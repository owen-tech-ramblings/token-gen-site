const canvas=$("game"),ctx=canvas.getContext("2d",{alpha:false});invariant(ctx,"Canvas 2D is required");
let W=innerWidth,H=innerHeight,DPR=1,lastFrame=0,raf=0;
function resize(){DPR=Math.min(devicePixelRatio,2);W=innerWidth;H=innerHeight;canvas.width=Math.max(1,Math.floor(W*DPR));canvas.height=Math.max(1,Math.floor(H*DPR));ctx.setTransform(DPR,0,0,DPR,0,0)}addEventListener("resize",resize);resize();
const profileRepository=createProfileRepository(localStorage);
let profile=profileRepository.load({readOnly:true});
let profileSaveError=null;
function reportProfileSaveError(error){profileSaveError=String(error?.message||error);console.error("Vampire Survival progress was not saved:",error);const status=$("menuStatus");if(status){status.textContent="Progress could not be saved in this tab. Keep it open, close other game tabs, and try changing a setting again.";status.classList.add("error")}if(state){state.toast="Progress not saved · keep this tab open";state.toastTime=6}}
function clearProfileSaveError(){if(!profileSaveError)return;profileSaveError=null;updateWriterLeaseUi()}
function persistProfileStrict(candidate=profile){
  if(!profileWriterLease)throw new Error("Another game tab owns profile writes");
  try{profile=profileRepository.save(candidate)}catch(error){
    if(!String(error?.message||error).startsWith("Stale profile revision:"))throw error;
    profile=profileRepository.saveMerged(candidate);
  }
  clearProfileSaveError();
  return profile;
}
function saveProfile(){try{return persistProfileStrict(profile)}catch(error){reportProfileSaveError(error);return profile}}
let audioContext=null,audioUnavailable=false;
function ensureAudio(){if(!profile.settings.audio||audioUnavailable)return null;try{const AudioCtor=window.AudioContext||window.webkitAudioContext;if(typeof AudioCtor!=="function"){audioUnavailable=true;return null}if(audioContext===null)audioContext=new AudioCtor();if(audioContext.state==="suspended"){const resumed=audioContext.resume();if(resumed&&typeof resumed.catch==="function")resumed.catch(()=>{audioUnavailable=true})}return audioContext}catch(error){audioUnavailable=true;console.warn("Vampire Survival audio is unavailable; continuing silently.",error);return null}}
function tone(f=180,d=.07,type="triangle",gain=.025,delay=0){if(!profile.settings.audio)return;const ac=ensureAudio();if(!ac)return;try{const o=ac.createOscillator(),g=ac.createGain(),start=ac.currentTime+delay;o.type=type;o.frequency.setValueAtTime(f,start);g.gain.setValueAtTime(gain,start);g.gain.exponentialRampToValueAtTime(.0001,start+d);o.connect(g);g.connect(ac.destination);o.start(start);o.stop(start+d+.02)}catch(error){audioUnavailable=true;console.warn("Vampire Survival audio stopped; gameplay will continue.",error)}}
function chord(...notes){notes.forEach((n,i)=>tone(n,.11,i===2?"sawtooth":"triangle",.018,i*.045))}
let rng=Math.random,state,player,enemies=[],relics=[],buildings=[],lanterns=[],particles=[],stains=[],bullets=[],pickups=[],hazards=[],telegraphs=[],floaters=[],camera={x:0,y:0,shake:0,zoom:1},keys={},mouse={x:W/2,y:H/2,down:false},touch={x:0,y:0,active:false},currentPacts=[],boss=null,entityCounter=0,coffinTransitionTimer=null;
