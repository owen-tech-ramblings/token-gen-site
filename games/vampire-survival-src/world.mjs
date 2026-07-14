function difficulty(){return DIFFICULTIES[state.difficulty]}

function runSeed(contract){
  if(contract.mode==="campaign")return `campaign:night-${contract.campaignNight}:${$("difficulty").value}`;
  return `${createRunSeed($("runMode").value)}:${contract.id}`;
}

function newRunId(){
  if(globalThis.crypto&&typeof globalThis.crypto.randomUUID==="function")return"run:"+globalThis.crypto.randomUUID();
  return"run:"+Date.now().toString(36)+":"+Math.random().toString(36).slice(2);
}

function districtAt(x,y){
  for(const d of DISTRICTS)if(x>=d.x&&x<d.x+d.w&&y>=d.y&&y<d.y+d.h)return d;
  throw new Error(`World position is outside all districts: ${x},${y}`);
}

function activeDistrict(){return districtAt(player.x,player.y)}

function rectCircleCollision(rect,x,y,r){
  const nx=clamp(x,rect.x,rect.x+rect.w),ny=clamp(y,rect.y,rect.y+rect.h);
  return(x-nx)**2+(y-ny)**2<r*r;
}

function blocked(x,y,r=15){
  if(x<r||y<r||x>WORLD.w-r||y>WORLD.h-r)return true;
  for(const b of buildings)if(rectCircleCollision(b,x,y,r))return true;
  return false;
}

function moveEntity(entity,dx,dy,radius){
  const nx=entity.x+dx;
  if(!blocked(nx,entity.y,radius))entity.x=nx;
  const ny=entity.y+dy;
  if(!blocked(entity.x,ny,radius))entity.y=ny;
  entity.x=clamp(entity.x,radius,WORLD.w-radius);
  entity.y=clamp(entity.y,radius,WORLD.h-radius);
}

function safePoint(preferredX,preferredY,radius=28){
  if(!blocked(preferredX,preferredY,radius))return{x:preferredX,y:preferredY};
  for(let ring=1;ring<28;ring++)for(let n=0;n<20;n++){
    const a=n/20*TAU,x=preferredX+Math.cos(a)*ring*28,y=preferredY+Math.sin(a)*ring*28;
    if(!blocked(x,y,radius))return{x,y};
  }
  throw new Error("Unable to locate a safe city position");
}

function makeCity(){
  buildings=[];lanterns=[];
  const road=118;
  for(const d of DISTRICTS){
    for(let gy=d.y+70;gy<d.y+d.h-80;gy+=190)for(let gx=d.x+70;gx<d.x+d.w-80;gx+=210){
      if(Math.abs((gx-d.x)%630)<road||Math.abs((gy-d.y)%570)<road)continue;
      const w=82+rng()*72,h=62+rng()*76;
      buildings.push({x:gx,y:gy,w,h,district:d.id,kind:rng()<.14?"tower":"house",lit:rng()<.42});
    }
    for(let i=0;i<18;i++)lanterns.push({x:d.x+50+rng()*(d.w-100),y:d.y+50+rng()*(d.h-100),r:65+rng()*48,p:rng()*TAU,district:d.id});
  }
  invariant(buildings.length>55,"City generation produced too few buildings");
}

function resetRun(options={}){
  const mode=options.mode||$("gameMode").value;
  const campaignNight=options.campaignNight||1;
  const huntDepth=options.huntDepth||1;
  const difficultyId=$("difficulty").value;
  const contract=createRunContract({mode,difficulty:DIFFICULTIES[difficultyId],campaignNight,huntDepth});
  const bloodlineStats=deriveBloodlineRunStats(profile.bloodline.allocation);
  const seed=runSeed(contract);
  rng=mulberry32(hashText(seed));
  makeCity();
  state={
    gamePhase:GAME_PHASES.MENU,runId:newRunId(),running:false,paused:false,over:false,win:false,
    mode,campaignNight:contract.campaignNight,huntDepth:contract.huntDepth,contract,
    time:0,score:0,phase:1,threat:1,difficulty:difficultyId,seed,spawnTimer:0,
    relicsBroken:0,requiredCrosses:contract.crossQuota,dawn:contract.dawn,grace:contract.grace,
    lieutenantsDefeated:0,requiredLieutenants:contract.lieutenantQuota||0,bossActive:false,bossDefeated:false,
    toast:"",toastTime:0,district:"",pactPending:0,hitStop:0,kills:0,damageTaken:0,
    roses:0,bossIntro:0,frenzy:0,bloodMoon:0,director:{pressure:1,budget:0},
    newAchievements:[],failureReason:null,clearCommitFailed:false,bloodlineStats,
  };
  player={
    x:WORLD.w/2,y:WORLD.h/2,radius:15,vx:0,vy:0,blood:bloodlineStats.maxBlood,maxBlood:bloodlineStats.maxBlood,xp:0,nextXp:62,
    level:1,speed:bloodlineStats.speed,range:bloodlineStats.range,feedDamage:bloodlineStats.feedDamage,attackCd:0,dashTime:0,dashCd:0,dashBase:bloodlineStats.dashCooldown,
    mistTime:0,mistCd:0,mistBase:bloodlineStats.mistBase,mistDuration:bloodlineStats.mistDuration,swarmCd:0,swarmDamage:bloodlineStats.swarmDamage,
    swarmRadius:bloodlineStats.swarmRadius,relicDamage:bloodlineStats.relicDamage,hitFlash:0,combo:0,comboTime:0,comboWindow:bloodlineStats.comboWindow,
    scoreBonus:0,magnet:bloodlineStats.magnet,roseHeal:bloodlineStats.roseHeal,echo:false,feedCount:0,thorns:false,
    frenzyGain:bloodlineStats.frenzyGain,pacts:{},lastDistrict:"",facing:0,
  };
  enemies=[];relics=[];particles=[];stains=[];bullets=[];pickups=[];hazards=[];
  telegraphs=[];floaters=[];currentPacts=[];boss=null;entityCounter=0;
  const spawn=safePoint(WORLD.w/2,WORLD.h/2);
  player.x=spawn.x;player.y=spawn.y;
  invariant(contract.crossPoints.length===state.requiredCrosses,"Cross layout must match the authored quota");
  contract.crossPoints.forEach((point,index)=>{
    const placed=safePoint(point[0],point[1],42),hp=150+index*45;
    relics.push({x:placed.x,y:placed.y,radius:34,hp,maxHp:hp,active:true,pulse:rng()*TAU,ward:0});
  });
  for(let i=0;i<18;i++)spawnEnemy("villager",true);
  for(let i=0;i<contract.startingGuards;i++)spawnEnemy("guard",true);
  for(let i=0;i<contract.startingHunters;i++)spawnEnemy("hunter",true,i===0);
  for(let i=0;i<(contract.lieutenantQuota||0);i++){
    const lieutenant=spawnEnemy(contract.lieutenantType,true,true);
    lieutenant.objectiveLieutenant=true;
    lieutenant.objectiveName=contract.lieutenantName;
    lieutenant.hp*=1.35;lieutenant.maxHp=lieutenant.hp;lieutenant.score*=1.35;
  }
  $("mission").textContent=contract.briefing;
  updateHud();
}

function enemyTypeForTime(){
  const p=state.phase,r=rng(),depthBoost=state.mode==="hunt"?Math.min(3,Math.floor((state.huntDepth-1)/3)):0,encounter=state.contract.encounter;
  if(encounter==="procession"&&p>=2&&r<.3)return"priest";
  if(encounter==="fog"&&p>=2&&r<.38)return"hunter";
  if(encounter==="lockdown"&&p>=3&&r<.2)return"captain";
  if(p+depthBoost>=5&&r<.09)return"captain";
  if(p+depthBoost>=4&&r<.24)return"priest";
  if(p+depthBoost>=3&&r<.48)return"hunter";
  if(p+depthBoost>=2&&r<.72)return"guard";
  return"villager";
}

function randomOpenPoint(inside=true){
  for(let tries=0;tries<120;tries++){
    let x,y;
    if(inside){x=60+rng()*(WORLD.w-120);y=60+rng()*(WORLD.h-120)}else{
      const edge=Math.floor(rng()*4);
      x=edge===1?WORLD.w-32:edge===3?32:60+rng()*(WORLD.w-120);
      y=edge===0?32:edge===2?WORLD.h-32:60+rng()*(WORLD.h-120);
    }
    if(!blocked(x,y,28)&&Math.hypot(x-player.x,y-player.y)>250)return{x,y};
  }
  throw new Error("Unable to spawn enemy in generated city");
}

function spawnEnemy(type=enemyTypeForTime(),inside=false,elite=false){
  const base=ENEMY_TYPES[type],point=randomOpenPoint(inside),difficultyContract=difficulty(),district=districtAt(point.x,point.y);
  elite=elite||(BUILD.upgrades&&type!=="villager"&&rng()<.035+state.phase*.012+state.contract.eliteBonus+(BUILD.districts&&district.id==="palace"?.06:0));
  const hp=base.hp*difficultyContract.enemyHp*state.contract.enemyHp*(elite?1.75:1);
  const enemy={
    id:"enemy-"+(++entityCounter),type,behaviour:base.behaviour,x:point.x,y:point.y,
    radius:base.radius+(elite?2:0),hp,maxHp:hp,speed:base.speed*(elite?1.12:1),
    damage:base.damage*difficultyContract.enemyDamage*state.contract.enemyDamage*(elite?1.35:1),
    score:base.score*(elite?2.1:1),xp:base.xp*(elite?1.7:1),
    state:base.behaviour==="flee"?"roam":"patrol",target:randomOpenPoint(true),
    cooldown:rng()*1.4,shotCd:.4+rng(),hit:0,angle:rng()*TAU,elite,
    shield:type!=="villager"&&rng()<.38,torch:rng()<.24,dead:false,
  };
  enemies.push(enemy);
  return enemy;
}

function spawnBoss(){
  if(boss!==null)return boss;
  const point=safePoint(WORLD.w*.5,220,45),base=ENEMY_TYPES.voss,difficultyContract=difficulty();
  boss={
    id:"captain-voss",type:"voss",behaviour:base.behaviour,x:point.x,y:point.y,radius:base.radius,
    hp:base.hp*difficultyContract.enemyHp*state.contract.enemyHp,maxHp:base.hp*difficultyContract.enemyHp*state.contract.enemyHp,speed:base.speed,
    damage:base.damage*difficultyContract.enemyDamage*state.contract.enemyDamage,score:base.score,xp:base.xp,state:"boss",
    cooldown:1.6,shotCd:1.1,hit:0,angle:0,phase:1,pattern:"arrival",patternTime:1.4,
    elite:true,dead:false,target:{x:player.x,y:player.y},
  };
  enemies.push(boss);state.bossIntro=BUILD.polish?1.35:0;
  $("bossWrap").style.display="block";$("bossWrap").classList.add("active");toast("Captain Voss enters the hunt",3);chord(72,61,49);
  return boss;
}
