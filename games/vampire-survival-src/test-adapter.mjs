const TESTING=new URLSearchParams(location.search).get("test")==="1";

function snapshot(){
  return{
    iteration:BUILD.iteration,gamePhase:state.gamePhase,runId:state.runId,running:state.running,
    paused:state.paused,over:state.over,win:state.win,time:state.time,score:state.score,
    mode:state.mode,campaignNight:state.campaignNight,huntDepth:state.huntDepth,ascension:state.ascension,huntMutator:state.huntMutator?{...state.huntMutator}:null,
    requiredCrosses:state.requiredCrosses,relicsBroken:state.relicsBroken,
    requiredLieutenants:state.requiredLieutenants,lieutenantsDefeated:state.lieutenantsDefeated,bossActive:state.bossActive,bossDefeated:state.bossDefeated,
    failureReason:state.failureReason,clearCommitFailed:state.clearCommitFailed,
    enemies:enemies.filter(enemy=>!enemy.dead).length,enemyTypes:Object.fromEntries(Object.keys(ENEMY_TYPES).map(type=>[type,enemies.filter(enemy=>!enemy.dead&&enemy.type===type).length])),buildings:buildings.length,
    district:activeDistrict().name,
    player:{x:player.x,y:player.y,blood:player.blood,maxBlood:player.maxBlood,level:player.level,pacts:{...player.pacts},combo:player.combo,dashCd:player.dashCd,dashBase:player.dashBase,thrallCd:player.thrallCd,mistCd:player.mistCd,swarmCd:player.swarmCd,speed:player.speed,range:player.range,feedDamage:player.feedDamage,relicDamage:player.relicDamage,roseHeal:player.roseHeal,mistDuration:player.mistDuration,frenzyGain:player.frenzyGain},
    abilities:{feed:currentAbilityStatus("feed"),dash:currentAbilityStatus("dash"),createThrall:currentAbilityStatus("createThrall"),mist:currentAbilityStatus("mist"),swarm:currentAbilityStatus("swarm")},
    boss:boss?{id:boss.id,type:boss.type,hp:boss.hp,maxHp:boss.maxHp,phase:boss.phase,pattern:boss.pattern,dead:boss.dead}:null,telegraphs:telegraphs.length,hazards:hazards.length,
    pactOpen:!$("pactModal").classList.contains("hidden"),endingOpen:!$("endingModal").classList.contains("hidden"),frenzy:state.frenzy,bloodMoon:state.bloodMoon,
    achievements:[...profile.achievements],seed:state.seed,
    coffinOutcome:profile.campaign.pendingCoffinOutcome?structuredClone(profile.campaign.pendingCoffinOutcome):null,
    finale:{endingUnlocked:profile.campaign.endingUnlocked,endingSeen:profile.campaign.endingSeen,ascensionUnlocked:profile.hunt.ascensionUnlocked},
    bloodPacks:profileBalance(profile),
    bloodline:{allocation:{...profile.bloodline.allocation},loadout:[...profile.bloodline.loadout],lastPurchaseId:profile.bloodline.lastPurchaseId,nextTransaction:profile.bloodline.nextTransaction,activeRunNodes:[...(state.bloodlineStats?.activeNodes||[])]},
    thralls:{active:thralls.map(thrall=>({id:thrall.id,sourceId:thrall.sourceId,targetId:thrall.targetId,life:thrall.life})),conversion:state.thrallConversion?{...state.thrallConversion}:null},
    citySignature:buildings.slice(0,12).map(building=>[Math.round(building.x),Math.round(building.y),Math.round(building.w),Math.round(building.h)].join(":" )).join("|"),
    entityCaps:{maxEnemies:BUILD_MAX_ENEMIES,particles:particles.length,bullets:bullets.length},
  };
}

function objectiveDiagnostics(){
  const crosses=relics.map((relic,index)=>({id:`cross-${index+1}`,x:relic.x,y:relic.y,hp:relic.hp,maxHp:relic.maxHp,active:relic.active,blocked:blocked(relic.x,relic.y,relic.radius)})),pending=crosses.filter(cross=>cross.active);
  let x=player.x,y=player.y,routeDistance=0;
  while(pending.length){
    pending.sort((left,right)=>Math.hypot(left.x-x,left.y-y)-Math.hypot(right.x-x,right.y-y));
    const next=pending.shift();routeDistance+=Math.hypot(next.x-x,next.y-y);x=next.x;y=next.y;
  }
  return{seed:state.seed,mode:state.mode,campaignNight:state.campaignNight,huntDepth:state.huntDepth,required:crosses.length,broken:state.relicsBroken,remaining:crosses.filter(cross=>cross.active).length,unique:new Set(crosses.map(cross=>`${Math.round(cross.x)}:${Math.round(cross.y)}`)).size===crosses.length,collisions:crosses.filter(cross=>cross.blocked).map(cross=>cross.id),greedyRouteDistance:Math.round(routeDistance),maxBaseTravelDistance:Math.round(state.dawn*player.speed),crosses};
}

if(TESTING){
  window.__VS_TEST__={
    start(options={}){if(options.difficulty)$("difficulty").value=options.difficulty;if(options.seedMode)$("runMode").value=options.seedMode;const mode=options.mode||"campaign";$("gameMode").value=mode;startRun({mode,campaignNight:options.campaignNight||1,huntDepth:options.huntDepth||1,ascension:Boolean(options.ascension)});return snapshot()},
    tick(seconds,step=1/60){const count=Math.ceil(seconds/step);for(let index=0;index<count;index++)update(step);draw();return snapshot()},
    snapshot,
    forceLevel(){player.xp=player.nextXp;levelCheck();return snapshot()},
    choosePact(index=0){choosePact(index);return snapshot()},
    breakRelics(){for(const relic of relics)if(relic.active)destroyRelic(relic);return snapshot()},
    defeatLieutenants(){for(const enemy of enemies)if(enemy.objectiveLieutenant&&!enemy.dead)damageEnemy(enemy,enemy.hp+1,false);return snapshot()},
    forceDawn({breakCrosses=false,defeatLieutenants=false}={}){if(breakCrosses)this.breakRelics();if(defeatLieutenants)this.defeatLieutenants();state.pactPending=0;state.paused=false;hideDialog("pactModal",false);state.hitStop=0;state.bossIntro=0;state.time=state.dawn;update(1/60);return snapshot()},
    finishCoffin(){finishCoffinTransition();return snapshot()},
    completeEnding(){completeEnding();return snapshot()},
    openBloodline(){openBloodline();return snapshot()},
    buyBloodline(nodeId){buyBloodlineNode(nodeId);return snapshot()},
    undoBloodline(){undoBloodline();return snapshot()},
    respecBloodline(){respecBloodlineTree();return snapshot()},
    closeBloodline(){closeBloodline();return snapshot()},
    openLoadout(){openTalentLoadout();return snapshot()},toggleTechnique(id){changeTalentLoadout(id);return snapshot()},closeLoadout(){closeTalentLoadout();return snapshot()},
    riseFromCoffin(){coffinRise();return snapshot()},
    leaveCoffin(){coffinLeave();return snapshot()},
    openCampaign(){openCampaignMap();return snapshot()},
    spawnBoss(){return BUILD.boss?(spawnBoss(),snapshot()):snapshot()},
    damageBoss(ratio=.4){invariant(boss,"Boss is not active");boss.hp=boss.maxHp*ratio;updateBossPhase();return snapshot()},
    killBoss(){invariant(boss,"Boss is not active");damageEnemy(boss,boss.hp+1,false);return snapshot()},
    move(dx,dy,seconds=.5){keys[dx>0?"KeyD":"KeyA"]=dx!==0;keys[dy>0?"KeyS":"KeyW"]=dy!==0;this.tick(seconds);keys={};return snapshot()},
    setPlayer(x,y){const point=safePoint(x,y,player.radius);player.x=point.x;player.y=point.y;return snapshot()},
    setPlayerExact(x,y){invariant(!blocked(x,y,player.radius),"Requested test position is blocked");player.x=x;player.y=y;return snapshot()},
    firstBuilding(){return structuredClone(buildings[0])},
    setGrace(seconds){state.grace=seconds;return snapshot()},
    setBlood(value){player.maxBlood=Math.max(player.maxBlood,value);player.blood=value;return snapshot()},
    setCooldowns({dash=0,createThrall=0,mist=0,swarm=0}={}){player.dashCd=dash;player.thrallCd=createThrall;player.mistCd=mist;player.swarmCd=swarm;updateHud();return snapshot()},
    unlockAbility(id){if(id==="createThrall"){profile.campaign.abilityUnlocks.createThrall=true;profile.campaign.clears["night-1"]={test:true}}else if(id==="mist"){profile.campaign.abilityUnlocks.mist=true;profile.campaign.clears["night-5"]={test:true}}else if(id==="swarm"){profile.campaign.abilityUnlocks.swarm=true;profile.campaign.clears["night-10"]={test:true}}else throw new Error("Unsupported test unlock");if(!profile.bloodline.loadout.includes(id)&&profile.bloodline.loadout.length<MAX_TALENT_SLOTS)profile.bloodline.loadout.push(id);profile.bloodline.loadoutConfigured=true;saveProfile();updateHud();return snapshot()},
    setThrallCandidates(specs=[{id:"enemy-a",dx:80,dy:0}]){const eligible=enemies.filter(enemy=>!enemy.dead&&enemy.type!=="voss"&&!enemy.objectiveLieutenant);while(eligible.length<specs.length)eligible.push(spawnEnemy("villager",true));specs.forEach((spec,index)=>{const enemy=eligible[index];enemy.id=spec.id;enemy.x=player.x+spec.dx;enemy.y=player.y+spec.dy;enemy.state="patrol";enemy.converting=false});updateHud();return snapshot()},
    expireThralls(){for(const thrall of thralls)thrall.life=0;updateThralls(1/60);return snapshot()},
    triggerThrall(){triggerCreateThrall();return snapshot()},triggerMist(){triggerMist();return snapshot()},triggerSwarm(){triggerSwarm();return snapshot()},triggerDash(){triggerDash();return snapshot()},
    triggerBloodMoon(){state.frenzy=1;triggerBloodMoon();return snapshot()},
    forceLoss(){player.blood=0;update(1/60);return snapshot()},
    districts(){return DISTRICTS.map(district=>district.name)},
    objectiveDiagnostics,
    profile(){return structuredClone(profile)},profileDiagnostics(){return profileRepository.diagnostics()},
    clearProfile(){profileRepository.clear({includeLegacy:true});profile=freshProfileV2();saveProfile();renderMenuProfile();return structuredClone(profile)},
  };
}

resetRun({mode:"campaign",campaignNight:1});
requestAnimationFrame(frame);
