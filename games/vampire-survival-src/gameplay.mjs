function emit(x,y,count,colour,life=.55,speed=150,size=3){if(!profile.settings.particles)count=Math.ceil(count*.35);for(let i=0;i<count;i++){const a=rng()*TAU,s=(.2+rng()*.8)*speed;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.25+rng()*life,max:.25+life,colour,size:.8+rng()*size})}}
function floater(x,y,text,colour="#ffd8df"){floaters.push({x,y,text,colour,life:.8,max:.8})}
function toast(text,duration=2.2){state.toast=text;state.toastTime=duration}
function award(id){if(!BUILD.platform||profile.achievements.includes(id))return;invariant(Object.hasOwn(ACHIEVEMENTS,id),"Unknown achievement "+id);profile.achievements.push(id);state.newAchievements.push(id);saveProfile();toast("Achievement: "+ACHIEVEMENTS[id],2.8)}
function takeDamage(amount,sourceX=player.x,sourceY=player.y){if(player.mistTime>0||state.over||state.time<state.grace)return;const actual=amount*(BUILD.polish&&state.bloodMoon>0?.78:1);player.blood-=actual;player.hitFlash=.25;state.damageTaken+=actual;if(profile.settings.shake)camera.shake=Math.max(camera.shake,8);emit(player.x,player.y,12,"#ff315a",.4,150,5);floater(player.x,player.y-18,"-"+Math.ceil(actual),"#ff7891");if(player.thorns){for(const e of [...enemies])if(!e.dead&&Math.hypot(e.x-player.x,e.y-player.y)<105)damageEnemy(e,12+player.level*2,false)}if(player.blood<=0)endRun(false)}
function damageEnemy(e,amount,lifeSteal=true){if(e.dead||e.converting)return;e.hp-=amount;e.hit=.16;emit(e.x,e.y,10,e.behaviour==="boss"?"#ffb36b":"#d81743",.4,170,4);floater(e.x,e.y-e.radius-8,Math.floor(amount),"#ffe1e6");if(lifeSteal)player.blood=Math.min(player.maxBlood,player.blood+amount*.23);if(BUILD.polish)state.hitStop=Math.max(state.hitStop,e.behaviour==="boss"?.035:.018);if(e.hp<=0)killEnemy(e);if(e===boss&&BUILD.boss)updateBossPhase()}
function killEnemy(e){if(e.dead)return;e.dead=true;const bossKill=e===boss;state.kills++;state.score+=Math.floor(e.score*(1+Math.min(player.combo,15)*.09+player.scoreBonus)*(state.contract.scoreMultiplier||1)*difficulty().score*(BUILD.districts&&activeDistrict().id==="palace"?1.2:1));player.xp+=e.xp;player.combo=player.comboTime>0?player.combo+1:1;player.comboTime=player.comboWindow;player.feedCount++;if(BUILD.polish)state.frenzy=clamp(state.frenzy+(7+Math.min(8,player.combo))*.01*player.frenzyGain,0,1);if(rng()<.24+(e.elite?.18:0)||bossKill)pickups.push({x:e.x,y:e.y,radius:8,life:24,pulse:rng()*TAU});stains.push({x:e.x,y:e.y,radius:5+rng()*10,life:30});emit(e.x,e.y,bossKill?90:24,"#bd1238",bossKill?1.4:.7,bossKill?340:210,bossKill?8:5);if(e.objectiveLieutenant){state.lieutenantsDefeated++;toast(`${e.objectiveName}: ${state.lieutenantsDefeated}/${state.requiredLieutenants}`,2.2)}if(state.kills===1)award("first_blood");if(player.combo>=10)award("combo10");if(bossKill){award(e.type);state.bossDefeated=true;if(state.bossActive)endRun(true)}levelCheck()}
function chooseTarget(){let best=null,bestScore=Infinity;const wx=mouse.x+camera.x,wy=mouse.y+camera.y;for(const e of enemies){if(e.dead||e.converting)continue;const pd=Math.hypot(e.x-player.x,e.y-player.y);if(pd>player.range+e.radius)continue;const aim=Math.hypot(e.x-wx,e.y-wy),score=aim*.72+pd*.28;if(score<bestScore){bestScore=score;best=e}}return best}
function feedOrStrike(){if(!state.running||state.paused||state.over||player.attackCd>0)return;player.attackCd=.22;const target=chooseTarget();if(target){const moon=BUILD.polish&&state.bloodMoon>0?1.32:1,damage=player.feedDamage*moon;damageEnemy(target,damage,true);tone(118+(target.type==="voss"?45:0),.06,"sawtooth",.022);if(player.echo&&player.feedCount%4===0&&!target.dead)damageEnemy(target,damage*.55,true)}else{emit(player.x+Math.cos(player.facing)*38,player.y+Math.sin(player.facing)*38,4,"#6f0b28",.25,80,3)}}
function levelCheck(){while(player.xp>=player.nextXp){player.xp-=player.nextXp;player.level++;player.nextXp=Math.floor(player.nextXp*1.34+18);player.maxBlood+=8;player.blood=Math.min(player.maxBlood,player.blood+30);if(BUILD.upgrades){state.pactPending++;openPact()}else{player.feedDamage*=1.08;player.speed*=1.025;toast("Dominion Level "+player.level);chord(180,245,360)}}}
function pactOptions(){const eligible=PACTS.filter(p=>(player.pacts[p.id]||0)<p.max);invariant(eligible.length>=3,"Not enough eligible Blood Pacts");const copy=[...eligible];for(let i=copy.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy.slice(0,3)}
function openPact(){if(!BUILD.upgrades||state.pactPending<1||state.over)return;state.paused=true;currentPacts=pactOptions();const host=$("pactChoices");host.replaceChildren(...currentPacts.map((p,i)=>{const b=document.createElement("button");b.className="choice";b.dataset.index=String(i);b.innerHTML=`<em>${i+1} · Rank ${(player.pacts[p.id]||0)+1}/${p.max}</em><strong>${p.name}</strong><small>${p.desc}</small>`;b.addEventListener("click",()=>choosePact(i));return b}));showDialog("pactModal",".choice")}
function choosePact(index){if(!profileWriterLease)return;invariant(BUILD.upgrades,"Blood Pacts are not enabled in this build");const pact=currentPacts[index];invariant(pact,"Invalid Blood Pact choice");player.pacts[pact.id]=(player.pacts[pact.id]||0)+1;pact.apply(player);state.pactPending--;hideDialog("pactModal",false);state.paused=false;canvas.focus();toast(pact.name);chord(210,280,420);if(state.pactPending>0)openPact()}
function isAbilityUnlocked(id){if(id==="feed"||id==="dash")return true;if(id==="createThrall")return Boolean(profile.campaign.abilityUnlocks.createThrall&&profile.campaign.clears["night-1"]);if(id==="mist")return Boolean(profile.campaign.abilityUnlocks.mist&&profile.campaign.clears["night-5"]);if(id==="swarm")return Boolean(profile.campaign.abilityUnlocks.swarm&&profile.campaign.clears["night-10"]);return false}
function isAbilityEquipped(id){return id==="feed"||id==="dash"||profile.bloodline.loadout.includes(id)}
function currentThrallTarget(){return stableNearestTarget(enemies,player,player.thrallRange)}
function currentAbilityStatus(id){const cooldown=id==="dash"?player.dashCd:id==="createThrall"?player.thrallCd:id==="mist"?player.mistCd:id==="swarm"?player.swarmCd:player.attackCd;return abilityAvailability(id,{unlocked:isAbilityUnlocked(id),equipped:isAbilityEquipped(id),busy:id==="createThrall"&&Boolean(state.thrallConversion),capacity:id!=="createThrall"||thralls.length<3,cooldown,blood:player.blood,targetAvailable:id!=="createThrall"||Boolean(currentThrallTarget())})}
function rejectAbility(status){if(state.toast!==status.label||state.toastTime<.25)toast(status.label,1.25)}
function triggerDash(){if(!state.running||state.paused)return;const status=currentAbilityStatus("dash");if(!status.ready){rejectAbility(status);return}player.dashTime=.18;player.dashCd=player.dashBase;emit(player.x,player.y,24,"#8f68ff",.5,240,5);tone(260,.07,"triangle",.02)}
function triggerMist(){if(!state.running||state.paused)return;const status=currentAbilityStatus("mist");if(!status.ready){rejectAbility(status);return}player.blood-=status.cost;player.mistTime=player.mistDuration;player.mistCd=player.mistBase;emit(player.x,player.y,44,"#b6a0ff",1,190,6);tone(188,.14,"sine",.02);toast("Mist form")}
function triggerSwarm(){if(!state.running||state.paused)return;const status=currentAbilityStatus("swarm");if(!status.ready){rejectAbility(status);return}player.blood-=status.cost;player.swarmCd=9.5;emit(player.x,player.y,76,"#1a1027",1.1,350,6);tone(54,.2,"sawtooth",.025);for(const e of [...enemies])if(!e.dead&&Math.hypot(e.x-player.x,e.y-player.y)<player.swarmRadius)damageEnemy(e,player.swarmDamage,false);toast("Bat swarm")}
function triggerCreateThrall(){if(!state.running||state.paused)return;const status=currentAbilityStatus("createThrall");if(!status.ready){rejectAbility(status);return}const target=currentThrallTarget();if(!target){rejectAbility(abilityAvailability("createThrall",{unlocked:true,equipped:true,targetAvailable:false,blood:player.blood}));return}player.blood-=status.cost;player.thrallCd=player.thrallBase;target.converting=true;state.thrallConversion={targetId:target.id,remaining:1.2,total:1.2};emit(target.x,target.y,30,"#77dcff",.8,130,5);tone(144,.18,"sine",.022);toast(`Converting ${target.type}`)}
function cancelThrallConversion(refund=false){const conversion=state?.thrallConversion;if(!conversion)return;const target=enemies.find(enemy=>enemy.id===conversion.targetId);if(target)target.converting=false;if(refund&&player){player.blood=Math.min(player.maxBlood,player.blood+ABILITY_RULES.createThrall.cost);player.thrallCd=0}state.thrallConversion=null}
function clearThrallState(){if(state)cancelThrallConversion(false);thralls=[]}
function nearestThrallHostile(thrall,maxDistance=460){let best=null,bestDistance=maxDistance;for(const enemy of enemies){if(enemy.dead||enemy.converting)continue;const distance=Math.hypot(enemy.x-thrall.x,enemy.y-thrall.y);if(!best||distance<bestDistance-1e-9||(Math.abs(distance-bestDistance)<=1e-9&&String(enemy.id).localeCompare(String(best.id))<0)){best=enemy;bestDistance=distance}}return best}
function completeThrallConversion(target){target.converting=false;target.dead=true;enemies=enemies.filter(enemy=>enemy!==target&&!enemy.dead);thralls.push({id:`thrall-${target.id}`,sourceId:target.id,x:target.x,y:target.y,radius:13,life:player.thrallLifetime,maxLife:player.thrallLifetime,speed:230,damage:player.thrallDamage,attackCd:0,retargetCd:0,targetId:null,angle:0});state.thrallConversion=null;emit(target.x,target.y,42,"#72d9ff",.9,210,5);chord(108,162,216);toast(`Thrall awakened · ${thralls.length}/3`)}
function updateThralls(dt){const conversion=state.thrallConversion;if(conversion){const target=enemies.find(enemy=>enemy.id===conversion.targetId&&!enemy.dead);if(!target)cancelThrallConversion(true);else{conversion.remaining=Math.max(0,conversion.remaining-dt);if(conversion.remaining<=0)completeThrallConversion(target)}}for(const thrall of thralls){thrall.life-=dt;thrall.attackCd=Math.max(0,thrall.attackCd-dt);thrall.retargetCd-=dt;let target=enemies.find(enemy=>enemy.id===thrall.targetId&&!enemy.dead&&!enemy.converting);if(!target||thrall.retargetCd<=0){target=nearestThrallHostile(thrall);thrall.targetId=target?.id||null;thrall.retargetCd=.35}let tx,ty;if(target){tx=target.x;ty=target.y}else{const lane=(Number(thrall.sourceId.split("-").at(-1))||1)%3-1;tx=player.x-48;ty=player.y+lane*42}const dx=tx-thrall.x,dy=ty-thrall.y,distance=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);thrall.angle=angle;if(distance>(target?target.radius+thrall.radius+10:24))moveEntity(thrall,Math.cos(angle)*thrall.speed*dt,Math.sin(angle)*thrall.speed*dt,thrall.radius);if(target&&distance<target.radius+thrall.radius+18&&thrall.attackCd<=0){damageEnemy(target,thrall.damage,false);thrall.attackCd=.65}}thralls=thralls.filter(thrall=>thrall.life>0)}
function triggerBloodMoon(){if(!BUILD.polish||state.bloodMoon>0||state.frenzy<1)return;state.frenzy=0;state.bloodMoon=9;player.blood=Math.min(player.maxBlood,player.blood+25);toast("Blood Moon",2.4);chord(90,135,220);emit(player.x,player.y,100,"#ff2758",1.5,380,8)}
function destroyRelic(r){r.active=false;state.relicsBroken++;state.score+=Math.floor(1000*difficulty().score);player.blood=Math.min(player.maxBlood,player.blood+38);for(let i=0;i<7;i++)pickups.push({x:r.x+(rng()-.5)*90,y:r.y+(rng()-.5)*90,radius:8,life:26,pulse:rng()*TAU});emit(r.x,r.y,95,"#f0c86b",1.25,340,9);if(profile.settings.shake)camera.shake=18;award("relic");toast(state.relicsBroken===state.requiredCrosses?"Crosses broken · survive until dawn":"Warding cross shattered",2.8);chord(330,220,92)}
function attackRelics(dt){if(!mouse.down)return;for(const r of relics){if(!r.active)continue;const d=Math.hypot(r.x-player.x,r.y-player.y);if(d<player.range+20){const district=BUILD.districts?districtAt(r.x,r.y):null,mult=district&&district.id==="cathedral"?1.2:1;r.hp-=player.relicDamage*mult*dt;player.blood-=1.2*dt;emit(r.x+(rng()-.5)*30,r.y+(rng()-.5)*30,2,"#ffe082",.3,70,4);if(r.hp<=0)destroyRelic(r);break}}}
function bossDisplayName(type=state.contract.bossId){return type==="sol"?"Archon Sol":type==="elowen"?"Sister Elowen":"Captain Voss"}
function updateBossPhase(){if(!boss||boss.dead)return;const ratio=boss.hp/boss.maxHp,next=ratio<.33?3:ratio<.66?2:1;if(next!==boss.phase){boss.phase=next;boss.patternTime=.8;boss.cooldown=.7;toast(`${bossDisplayName(boss.type)} · Phase ${["","I","II","III"][next]}`,2.4);chord(74-next*5,62-next*4,50-next*3)}}
function bossAttack(){if(boss.type==="elowen"){elowenAttack();return}if(boss.type==="sol"){solAttack();return}const p=boss.phase,choice=Math.floor(rng()*(p+1));if(choice===0){boss.pattern="volley";boss.patternTime=.9;telegraphs.push({type:"ring",x:boss.x,y:boss.y,radius:160+p*34,time:.9,life:.9,owner:"voss"})}else if(choice===1){boss.pattern="charge";boss.patternTime=.72;const a=Math.atan2(player.y-boss.y,player.x-boss.x);telegraphs.push({type:"lane",x:boss.x,y:boss.y,angle:a,length:560,width:55,time:.72,life:.72,owner:"voss"})}else if(choice===2){boss.pattern="sanctify";boss.patternTime=1.05;for(let i=0;i<2+p;i++)telegraphs.push({type:"circle",x:player.x+(rng()-.5)*330,y:player.y+(rng()-.5)*260,radius:62+p*5,time:1.05,life:1.05,owner:"voss"})}else{boss.pattern="summon";boss.patternTime=.85;for(let i=0;i<p+1;i++)spawnEnemy(i%2?"hunter":"priest",true,p===3&&i===0)}}
function elowenAttack(){const p=boss.phase,choice=Math.floor(rng()*(2+p));if(choice<=1){boss.pattern="toll";boss.patternTime=1.05;for(let i=0;i<2+p;i++)telegraphs.push({type:"circle",x:player.x+(i-(p+1)/2)*85,y:player.y+(rng()-.5)*90,radius:54,time:.72+i*.14,life:.72+i*.14,owner:"elowen",damage:boss.damage*.72})}else if(choice===2){boss.pattern="peal";boss.patternTime=.88;telegraphs.push({type:"ring",x:boss.x,y:boss.y,radius:190+p*26,time:.88,life:.88,owner:"elowen"})}else if(choice===3){boss.pattern="charge";boss.patternTime=.64;const a=Math.atan2(player.y-boss.y,player.x-boss.x);telegraphs.push({type:"lane",x:boss.x,y:boss.y,angle:a,length:650,width:48,time:.64,life:.64,owner:"elowen"})}else{boss.pattern="summon";boss.patternTime=.78;for(let i=0;i<p;i++)spawnEnemy("bellkeeper",true,i===0&&p===3)}}
function solAttack(){const p=boss.phase,choice=Math.floor(rng()*(3+p));if(choice<=1){boss.pattern="sunfall";boss.patternTime=1;for(let i=0;i<3+p;i++){const a=i/(3+p)*TAU,radius=115+(i%2)*105;telegraphs.push({type:"circle",x:player.x+Math.cos(a)*radius,y:player.y+Math.sin(a)*radius,radius:58,time:.7+i*.09,life:.7+i*.09,owner:"sol",damage:boss.damage*.78})}}else if(choice===2){boss.pattern="corona";boss.patternTime=.82;telegraphs.push({type:"ring",x:boss.x,y:boss.y,radius:220+p*30,time:.82,life:.82,owner:"sol"})}else if(choice===3){boss.pattern="charge";boss.patternTime=.58;const base=Math.atan2(player.y-boss.y,player.x-boss.x);for(const offset of[-.13,.13])telegraphs.push({type:"lane",x:boss.x,y:boss.y,angle:base+offset,length:720,width:42,time:.58,life:.58,owner:"sol"})}else{boss.pattern="summon";boss.patternTime=.72;const types=["captain","bellkeeper","priest"];for(let i=0;i<p+1;i++)spawnEnemy(types[i%types.length],true,i===0)}}
function executeTelegraph(t){if(t.type==="ring"){const count=10+(boss?boss.phase*4:0);for(let i=0;i<count;i++){const a=i/count*TAU;bullets.push({x:t.x,y:t.y,vx:Math.cos(a)*290,vy:Math.sin(a)*290,radius:5,damage:boss?boss.damage*.65:10,life:3,colour:t.owner==="elowen"?"#9cecff":"#ffd26c"})}}else if(t.type==="lane"&&boss){const a=t.angle;boss.x=clamp(boss.x+Math.cos(a)*t.length,40,WORLD.w-40);boss.y=clamp(boss.y+Math.sin(a)*t.length,40,WORLD.h-40);if(Math.abs(Math.sin(a)*(player.x-t.x)-Math.cos(a)*(player.y-t.y))<t.width&&Math.hypot(player.x-t.x,player.y-t.y)<t.length)takeDamage(boss.damage*1.25,boss.x,boss.y)}else if(t.type==="circle"){hazards.push({x:t.x,y:t.y,radius:t.radius,life:t.owner==="bellkeeper"?1.4:4.2,tick:t.owner==="bellkeeper"?.6:0,kind:t.owner==="bellkeeper"?"bell":"sun"});if(Math.hypot(player.x-t.x,player.y-t.y)<t.radius)takeDamage(t.damage??(boss?boss.damage*.75:9),t.x,t.y)}}
function updateTelegraphs(dt){for(let i=telegraphs.length-1;i>=0;i--){const t=telegraphs[i];t.time-=dt;if(t.time<=0){executeTelegraph(t);telegraphs.splice(i,1)}}}
function updateHazards(dt){for(let i=hazards.length-1;i>=0;i--){const h=hazards[i];h.life-=dt;h.tick-=dt;if(h.tick<=0&&Math.hypot(player.x-h.x,player.y-h.y)<h.radius){h.tick=.55;takeDamage(h.kind==="thorn"?5:8,h.x,h.y)}if(h.life<=0)hazards.splice(i,1)}}
function updateEnemy(e,dt){if(e.dead||e.converting)return;e.hit=Math.max(0,e.hit-dt);e.cooldown-=dt;e.shotCd-=dt;if(e.behaviour==="boss"){updateBoss(e,dt);return}const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy);if(e.behaviour==="flee")e.state=d<220?"flee":"roam";else if(d<420)e.state="hunt";else if(e.state==="hunt"&&d>620)e.state="patrol";let tx=e.target.x,ty=e.target.y;if(e.state==="hunt"){if((e.behaviour==="range"||e.behaviour==="bell")&&d<240){tx=e.x-dx;ty=e.y-dy}else if(e.behaviour==="flank"){const side=e.id.charCodeAt(0)%2?1:-1;tx=player.x-dy/Math.max(d,1)*90*side;ty=player.y+dx/Math.max(d,1)*90*side}else{tx=player.x;ty=player.y}}else if(e.state==="flee"){tx=e.x-dx;ty=e.y-dy}else if(Math.hypot(e.x-tx,e.y-ty)<35)e.target=randomOpenPoint(true);const a=Math.atan2(ty-e.y,tx-e.x);e.angle=a;const speed=e.speed*(e.state==="hunt"?1.12:e.state==="flee"?1.28:.68)*(BUILD.polish&&state.bloodMoon>0?.94:1);moveEntity(e,Math.cos(a)*speed*dt,Math.sin(a)*speed*dt,e.radius);if(e.state==="hunt"&&d<e.radius+player.radius+5&&e.cooldown<=0){takeDamage(e.damage,e.x,e.y);e.cooldown=.75}if(e.behaviour==="bell"&&e.state==="hunt"&&d<520&&e.shotCd<=0){telegraphs.push({type:"circle",x:player.x,y:player.y,radius:52,time:.8,life:.8,owner:"bellkeeper",damage:e.damage});e.shotCd=2.45}else if((e.behaviour==="flank"||e.behaviour==="range"||e.type==="captain")&&e.state==="hunt"&&d<500&&d>100&&e.shotCd<=0){const aa=Math.atan2(dy,dx),speedShot=e.behaviour==="range"?350:310;bullets.push({x:e.x,y:e.y,vx:Math.cos(aa)*speedShot,vy:Math.sin(aa)*speedShot,radius:e.behaviour==="range"?6:4,damage:e.damage*.82,life:2.4,colour:e.behaviour==="range"?"#ffe38a":"#cfdae8"});e.shotCd=e.type==="captain"?1.1:1.55}}
function updateBoss(e,dt){if(!BUILD.boss)return;const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy);if(state.bossIntro>0)return;e.patternTime-=dt;e.cooldown-=dt;if(e.patternTime<=0&&e.cooldown<=0){bossAttack();const base=e.type==="sol"?1.72:e.type==="elowen"?1.9:2.15;e.cooldown=Math.max(.7,base-e.phase*.28)}if(e.pattern==="charge"&&e.patternTime>0)return;const a=Math.atan2(dy,dx);e.angle=a;const desired=e.type==="sol"?(e.phase===1?230:e.phase===2?185:145):e.type==="elowen"?(e.phase===1?260:e.phase===2?220:180):(e.phase===1?190:e.phase===2?155:125);if(d>desired+30)moveEntity(e,Math.cos(a)*e.speed*dt,Math.sin(a)*e.speed*dt,e.radius);else if(d<desired-35)moveEntity(e,-Math.cos(a)*e.speed*.68*dt,-Math.sin(a)*e.speed*.68*dt,e.radius);if(d<e.radius+player.radius+4&&e.cooldown<=.2)takeDamage(e.damage,e.x,e.y)}
function collectPickups(dt){for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];p.life-=dt;p.pulse+=dt*5;const dx=player.x-p.x,dy=player.y-p.y,d=Math.hypot(dx,dy);if(d<player.magnet&&d>1){p.x+=dx/d*260*dt;p.y+=dy/d*260*dt}if(d<player.radius+p.radius+5){const district=BUILD.districts?districtAt(p.x,p.y):null,heal=player.roseHeal*(district&&district.id==="gardens"?1.3:1)*(state.huntMutator?.id==="blood-famine"?.7:1);player.blood=Math.min(player.maxBlood,player.blood+heal);player.xp+=10;state.score+=130;state.roses++;tone(320,.06,"triangle",.017);emit(p.x,p.y,13,"#ff4770",.45,135,4);pickups.splice(i,1);levelCheck()}else if(p.life<=0)pickups.splice(i,1)}}
function districtEffects(){if(!BUILD.districts)return;const d=activeDistrict();if(d.id!==player.lastDistrict){player.lastDistrict=d.id;state.district=d.name;$("districtBanner").textContent=d.name;$("districtBanner").style.opacity="1";setTimeout(()=>{$("districtBanner").style.opacity="0"},1600)}if(d.id==="cathedral"&&Math.floor(state.time)%13===0&&hazards.filter(h=>h.kind==="sun").length<2){const p=safePoint(player.x+(rng()-.5)*380,player.y+(rng()-.5)*300,20);hazards.push({x:p.x,y:p.y,radius:55,life:2.8,tick:.7,kind:"sun"})}if(d.id==="gardens"&&Math.floor(state.time)%17===0&&hazards.filter(h=>h.kind==="thorn").length<3){hazards.push({x:player.x+(rng()-.5)*420,y:player.y+(rng()-.5)*360,radius:48,life:4,tick:.8,kind:"thorn"})}if(state.huntMutator?.id==="silver-rain"&&Math.floor(state.time)%11===0&&hazards.filter(h=>h.kind==="silver-rain").length<2){const p=safePoint(player.x+(rng()-.5)*360,player.y+(rng()-.5)*280,20);hazards.push({x:p.x,y:p.y,radius:58,life:3,tick:.65,kind:"silver-rain"})}}
function inputVector(){let x=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),y=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0);if(BUILD.platform){x+=touch.x;y+=touch.y;const pads=navigator.getGamepads?navigator.getGamepads():[];const pad=pads&&pads[0];if(pad){x+=Math.abs(pad.axes[0])>.16?pad.axes[0]:0;y+=Math.abs(pad.axes[1])>.16?pad.axes[1]:0;if(pad.buttons[0].pressed)feedOrStrike();if(pad.buttons[1].pressed)triggerDash();if(pad.buttons[2].pressed)triggerSwarm();if(pad.buttons[3].pressed)triggerMist()}}const len=Math.hypot(x,y);return len>1?{x:x/len,y:y/len}:{x,y}}
function updatePlayer(dt){const v=inputVector(),district=BUILD.districts?activeDistrict():null,moon=BUILD.polish&&state.bloodMoon>0?1.22:1,dock=district&&district.id==="docks"?1.08:1,speed=player.speed*dock*moon*(player.mistTime>0?1.34:1)*(player.dashTime>0?3.45:1);player.vx=lerp(player.vx,v.x*speed,clamp(dt*14,0,1));player.vy=lerp(player.vy,v.y*speed,clamp(dt*14,0,1));moveEntity(player,player.vx*dt,player.vy*dt,player.radius);player.facing=Math.atan2(mouse.y+camera.y-player.y,mouse.x+camera.x-player.x);player.attackCd=Math.max(0,player.attackCd-dt);player.dashTime=Math.max(0,player.dashTime-dt);player.dashCd=Math.max(0,player.dashCd-dt);player.thrallCd=Math.max(0,player.thrallCd-dt);player.mistTime=Math.max(0,player.mistTime-dt);player.mistCd=Math.max(0,player.mistCd-dt);player.swarmCd=Math.max(0,player.swarmCd-dt);player.hitFlash=Math.max(0,player.hitFlash-dt);player.comboTime=Math.max(0,player.comboTime-dt);if(player.comboTime<=0)player.combo=0;if(mouse.down)feedOrStrike();player.blood-=dt*(.56+state.phase*.055+state.relicsBroken*.045)*(state.bloodMoon>0?.55:1);if(player.blood<=0)endRun(false)}
function updateDirector(dt){const d=difficulty(),contractPressure=state.contract.pressure;state.phase=clamp(Math.floor(state.time/34)+1,1,7);state.threat=state.phase+state.relicsBroken+(state.mode==="hunt"?state.huntDepth-1:0)+(boss?3:0);if(BUILD.polish){const health=player.blood/player.maxBlood,target=.85+state.phase*.16+(health>.72?.22:health<.3?-.18:0);state.director.pressure=lerp(state.director.pressure,target,dt*.25);state.director.budget+=dt*d.spawn*contractPressure*state.director.pressure}else state.director.budget+=dt*d.spawn*contractPressure*(.78+state.phase*.16);while(state.director.budget>=1){state.director.budget-=1;spawnEnemy(enemyTypeForTime(),false,BUILD.upgrades&&rng()<.02+state.phase*.006+state.contract.eliteBonus)}const converting=enemies.find(enemy=>enemy.id===state.thrallConversion?.targetId);trimEntityOverflow(enemies,BUILD_MAX_ENEMIES,player,[boss,converting,...enemies.filter(enemy=>enemy.objectiveLieutenant&&!enemy.dead)])}
const BUILD_MAX_ENEMIES=BUILD.polish?108:92;
function beginMilestoneBoss(){
  state.bossActive=true;state.gamePhase=GAME_PHASES.BOSS_ACTIVE;state.time=state.dawn;
  cancelThrallConversion(true);
  enemies=[];bullets=[];hazards=[];telegraphs=[];pickups=[];boss=null;
  spawnBoss();
  const bossLabel=bossDisplayName();
  $("mission").textContent=`Dawn phase: defeat ${bossLabel}. The night clears only when the boss falls.`;
  toast(`Dawn breaks · defeat ${bossLabel} to reach the coffin`,3.2);
  updateHud();
}
function updateCombatCollections(dt){for(const e of enemies)updateEnemy(e,dt);updateThralls(dt);for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0||blocked(b.x,b.y,b.radius)){bullets.splice(i,1);continue}if(Math.hypot(b.x-player.x,b.y-player.y)<b.radius+player.radius){takeDamage(b.damage,b.x,b.y);bullets.splice(i,1)}}updateTelegraphs(dt);updateHazards(dt);collectPickups(dt);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.94;p.vy*=.94;p.life-=dt}particles=particles.filter(p=>p.life>0);for(const f of floaters){f.y-=28*dt;f.life-=dt}floaters=floaters.filter(f=>f.life>0);for(const s of stains)s.life-=dt;stains=stains.filter(s=>s.life>0);enemies=enemies.filter(e=>!e.dead)}
function update(dt){if(!profileWriterLease||!state.running||state.paused||state.over)return;if(state.hitStop>0){state.hitStop-=dt;return}if(state.bossIntro>0){state.bossIntro-=dt;return}state.toastTime=Math.max(0,state.toastTime-dt);if(state.bossActive){state.score+=dt*18*(state.contract.scoreMultiplier||1);updatePlayer(dt);updateCombatCollections(dt);updateHud();return}state.time+=dt;state.score+=dt*(4+state.phase*.8+state.relicsBroken*2)*(state.contract.scoreMultiplier||1)*(BUILD.polish&&state.bloodMoon>0?2.2:1);if(state.time>=state.dawn){if(state.relicsBroken<state.requiredCrosses){state.failureReason="dawn-crosses";toast("Dawn sealed the remaining crosses",1);endRun(false,"dawn-crosses")}else if(state.lieutenantsDefeated<state.requiredLieutenants){state.failureReason="dawn-lieutenants";toast("Dawn rescued the surviving lieutenants",1);endRun(false,"dawn-lieutenants")}else if(state.contract.bossId){beginMilestoneBoss()}else endRun(true);return}if(BUILD.polish){state.bloodMoon=Math.max(0,state.bloodMoon-dt);if(state.frenzy>=1&&state.bloodMoon<=0)triggerBloodMoon()}updatePlayer(dt);updateDirector(dt);attackRelics(dt);districtEffects();updateCombatCollections(dt);updateHud()}
function gradeRun(win){
  if(!win)return state.relicsBroken===state.requiredCrosses?"C":state.relicsBroken===Math.max(0,state.requiredCrosses-1)?"D+":"D";
  const points=88-Math.min(28,state.damageTaken*.18)+Math.min(12,state.kills*.18)+Math.min(16,player.combo*1.4)+(state.difficulty==="nightmare"?12:state.difficulty==="night"?6:0);
  return points>=108?"S":points>=94?"A":points>=80?"B":"C";
}

function outcomePayload(win,grade){return{runId:state.runId,mode:state.mode,campaignNight:state.campaignNight,huntDepth:state.huntDepth,score:state.score,time:state.time,grade,win,difficulty:state.difficulty}}

function commitRunOutcome(win,grade){
  try{
    const draft=normaliseProfileV2(profile),result=recordProfileRunOutcome(draft,outcomePayload(win,grade));
    persistProfileStrict(draft);
    return result;
  }catch(error){
    state.clearCommitFailed=win;
    reportProfileSaveError(error);
    return null;
  }
}

function renderResult(grade,reason){
  const crossesRemaining=Math.max(0,state.requiredCrosses-state.relicsBroken),saveFailed=reason==="save-failed";
  $("resultEyebrow").textContent=saveFailed?"The chronicle fractured":reason==="dawn-crosses"?"The city seals itself":reason==="dawn-lieutenants"?"The quarry escaped":"The hunters prevail";
  $("resultTitle").textContent=saveFailed?"Progress Not Saved":reason==="dawn-crosses"?"Dawn Claimed the Crosses":reason==="dawn-lieutenants"?"Dawn Saved the Lieutenants":"You Perished";
  $("resultText").textContent=saveFailed
    ?"The night ended, but its result could not be committed. Keep this tab open, close other game tabs, and retry the night."
    :reason==="dawn-crosses"
      ?`${crossesRemaining} warding ${crossesRemaining===1?"cross remained":"crosses remained"} when dawn arrived. Every cross must fall before the timer reaches zero. Night grade: ${grade}.`
      :reason==="dawn-lieutenants"
        ?`${state.requiredLieutenants-state.lieutenantsDefeated} of ${state.contract.lieutenantName} escaped at dawn. Defeat every marked lieutenant before the timer reaches zero. Night grade: ${grade}.`
      :`The bloodline ended before dawn. Night grade: ${grade}.`;
  const metrics=[["Grade",grade],["Score",Math.floor(state.score)],["Time",Math.floor(state.time)+"s"],["Kills",state.kills],["Crosses",state.relicsBroken+"/"+state.requiredCrosses],["Lieutenants",state.lieutenantsDefeated+"/"+state.requiredLieutenants],["Dominion",player.level],["Roses",state.roses]];
  $("resultMetrics").innerHTML=metrics.map(([key,value])=>`<div class="metric"><b>${value}</b><span>${key}</span></div>`).join("");
  $("resultAchievements").innerHTML=state.newAchievements.map(id=>`<span class="badge">${ACHIEVEMENTS[id]}</span>`).join("");
  renderScores();showDialog("resultModal","#againBtn");chord(78,64,50);
}

function endRun(win,reason=null){
  if(state.over)return;
  state.over=true;state.running=false;state.gamePhase=GAME_PHASES.RESULT;state.win=win;
  const grade=gradeRun(win);
  if(win&&state.damageTaken<1)award("untouched");
  if(win&&grade==="S")award("s_rank");
  if(win&&state.mode==="hunt"&&$("runMode").value==="daily")award("daily");
  const committed=commitRunOutcome(win,grade);
  clearThrallState();
  $("bossWrap").style.display="none";$("bossWrap").classList.remove("active");
  if(!committed){renderResult(grade,"save-failed");return}
  if(win){showCoffinTransition(committed.coffinOutcome);chord(220,330,440);return}
  renderResult(grade,reason||state.failureReason);
}

function showCoffinTransition(outcome){
  invariant(outcome,"A committed coffin outcome is required");
  state.gamePhase=GAME_PHASES.COFFIN_TRANSITION;state.coffinOutcome=outcome;
  state.restoredFrom=Math.max(0,Math.ceil(player.blood));
  player.blood=player.maxBlood;player.attackCd=0;player.dashCd=0;player.dashTime=0;player.thrallCd=0;player.mistCd=0;player.mistTime=0;player.swarmCd=0;
  $("coffinTransitionText").textContent=outcome.mode==="campaign"?`Night ${outcome.night} is survived. The vampire returns to his coffin before daylight.`:`Hunt Depth ${outcome.depth} is survived. Daylight closes over the city.`;
  const transition=$("coffinTransition");transition.classList.remove("coffin-playing");void transition.offsetWidth;transition.classList.add("coffin-playing");
  showDialog("coffinTransition","#skipCoffinBtn");
  clearTimeout(coffinTransitionTimer);
  coffinTransitionTimer=setTimeout(finishCoffinTransition,profile.settings.reducedMotion?650:4000);
}

function finishCoffinTransition(){
  if(state.gamePhase!==GAME_PHASES.COFFIN_TRANSITION)return;
  clearTimeout(coffinTransitionTimer);coffinTransitionTimer=null;
  hideDialog("coffinTransition",false);
  if(state.coffinOutcome?.endingUnlocked&&!profile.campaign.endingSeen){state.gamePhase=GAME_PHASES.ENDING;renderEnding();showDialog("endingModal","#endingContinueBtn");return}
  state.gamePhase=GAME_PHASES.COFFIN_HUB;
  renderCoffinHub();showDialog("coffinHub","#coffinRiseBtn");
}

function renderEnding(){$("endingLegacy").textContent=`The fifteen-night chronicle is committed. Ascension Hunt is unlocked; bosses return every five depths and rotating rites now shape every descent.`}
function completeEnding(){if(!profileWriterLease||state.gamePhase!==GAME_PHASES.ENDING)return;try{const draft=normaliseProfileV2(profile);draft.campaign.endingSeen=true;persistProfileStrict(draft)}catch(error){reportProfileSaveError(error);$("endingLegacy").textContent="The ending could not be acknowledged safely. Close other game tabs and try again.";return}hideDialog("endingModal",false);state.gamePhase=GAME_PHASES.COFFIN_HUB;renderCoffinHub();showDialog("coffinHub","#coffinRiseBtn")}

function renderCoffinHub(){
  const pending=profile.campaign.pendingCoffinOutcome;
  if(!pending){returnToTitle();return}
  const label=pending.mode==="campaign"?`Campaign Night ${pending.night}`:`Hunt Depth ${pending.depth}`;
  $("coffinTitle").textContent=`${label} Survived`;
  $("coffinSummary").textContent=pending.endingUnlocked?"Archon Sol is defeated. The ending and Ascension Hunt were committed before this coffin opened.":pending.swarmUnlocked?"Sister Elowen is defeated. Swarm was unlocked in the same committed clear.":pending.mistUnlocked?"Captain Voss is defeated. Mist and full Hunt were unlocked in the same committed clear.":pending.firstClear?"First clear secured. The reward was committed before the coffin closed.":"The night is recorded. Repeat clears sharpen mastery without duplicating first-clear rewards.";
  const rewards=[["Blood",`${player.maxBlood}/${player.maxBlood}`],["Cooldowns","Ready"],["Reward",pending.bloodPacks?`+${pending.bloodPacks} Blood Pack`:"No repeat pack"],["Balance",`${profileBalance(profile)} Blood Pack${profileBalance(profile)===1?"":"s"}`]];
  if(pending.mode==="hunt")rewards.push(["Best depth",profile.hunt.bestDepth]);
  $("coffinMetrics").innerHTML=rewards.map(([key,value])=>`<div class="metric"><b>${value}</b><span>${key}</span></div>`).join("");
  $("coffinRestoreText").textContent=`Blood restored from ${state.restoredFrom??player.maxBlood} to ${player.maxBlood}. Cooldowns are ready. ${profile.campaign.abilityUnlocks.mist?"Mist is unlocked.":"Mist unlocks after the Night 5 boss;"} ${profile.campaign.abilityUnlocks.swarm?"Swarm is unlocked.":"Swarm unlocks after the Night 10 boss."}`;
  const ownedNodes=Object.keys(profile.bloodline.allocation).length,totalNodes=BLOODLINE_BRANCHES.reduce((total,branch)=>total+branch.nodes.length,0);
  $("coffinBloodlineText").textContent=`${ownedNodes}/${totalNodes} nodes awakened. Spend ${profileBalance(profile)} Blood Pack${profileBalance(profile)===1?"":"s"}; changes apply when the next night begins.`;
  const selected=profile.bloodline.loadout.map(id=>TALENT_TECHNIQUES.find(technique=>technique.id===id)?.name).filter(Boolean);
  $("coffinLoadoutText").textContent=selected.length?`${selected.join(" + ")} selected. Feed and Dash remain core techniques.`:"No signature techniques selected. Feed and Dash remain available.";
  $("coffinRiseBtn").textContent=pending.mode==="campaign"?(pending.nextNight?`Rise for Night ${pending.nextNight}`:"Return to Campaign"):profile.hunt.unlocked?`Descend to Hunt Depth ${pending.nextDepth}`:"Return to Campaign";
}

let activeBloodlineBranch="hunger";

function renderBloodline(message=""){
  const balance=profileBalance(profile),owned=Object.keys(profile.bloodline.allocation).length;
  const totalNodes=BLOODLINE_BRANCHES.reduce((total,branch)=>total+branch.nodes.length,0);
  $("bloodlineBalance").textContent=`${balance} Blood Pack${balance===1?"":"s"} available · ${owned}/${totalNodes} nodes awakened`;
  document.querySelectorAll("[data-bloodline-tab]").forEach(tab=>{
    const active=tab.dataset.bloodlineTab===activeBloodlineBranch;
    tab.classList.toggle("active",active);tab.setAttribute("aria-selected",String(active));tab.tabIndex=active?0:-1;
  });
  $("bloodlineTree").replaceChildren(...BLOODLINE_BRANCHES.map(branch=>{
    const section=document.createElement("section");section.className=`bloodline-branch${branch.id===activeBloodlineBranch?" active":""}`;section.dataset.branch=branch.id;
    section.innerHTML=`<header><div class="eyebrow">${branch.theme}</div><h3>${branch.name}</h3></header><div class="bloodline-path"></div>`;
    const path=section.querySelector(".bloodline-path");
    path.replaceChildren(...branch.nodes.map(node=>{
      const status=bloodlineNodeStatus(profile,node.id),prerequisite=node.prerequisite?bloodlineNodeById(node.prerequisite):null;
      const card=document.createElement("article");card.className=`bloodline-node ${status.owned?"owned":status.available?"available":"locked"}`;
      const action=status.owned?"Awakened":!status.prerequisiteMet?`Requires ${prerequisite.name}`:status.affordable?`Awaken · ${node.cost} Pack${node.cost===1?"":"s"}`:`Need ${node.cost} Pack${node.cost===1?"":"s"}`;
      card.innerHTML=`<div class="bloodline-node-top"><span>Rank ${status.owned?1:0}/1</span><span>${node.cost} Pack${node.cost===1?"":"s"}</span></div><h4>${node.name}</h4><p>${node.flavor}</p><div class="bloodline-effect"><b>Current</b><span>${status.owned?node.effect:"Dormant"}</span><b>Next</b><span>${status.owned?"Fully awakened":node.effect}</span></div><button class="${status.available?"primary":"secondary"}" data-bloodline-node="${node.id}" ${status.available?"":"disabled"}>${action}</button>`;
      return card;
    }));
    return section;
  }));
  document.querySelectorAll("[data-bloodline-node]").forEach(button=>button.addEventListener("click",()=>buyBloodlineNode(button.dataset.bloodlineNode)));
  $("bloodlineUndoBtn").disabled=!profileWriterLease||!profile.bloodline.lastPurchaseId;
  $("bloodlineRespecBtn").disabled=!profileWriterLease||owned===0;
  $("bloodlineStatus").textContent=message||"Purchases save atomically. Undo reverses the latest purchase; Respec refunds every active node during roadmap validation.";
}

function openBloodline(){
  if(!profileWriterLease||state.gamePhase!==GAME_PHASES.COFFIN_HUB)return;
  hideDialog("coffinHub",false);state.gamePhase=GAME_PHASES.BLOODLINE;renderBloodline();showDialog("bloodlineModal",'[data-bloodline-node]:not([disabled]), #bloodlineCloseBtn');
}

function closeBloodline(){
  if(state.gamePhase!==GAME_PHASES.BLOODLINE)return;
  hideDialog("bloodlineModal",false);state.gamePhase=GAME_PHASES.COFFIN_HUB;renderCoffinHub();showDialog("coffinHub","#bloodlineBtn");
}

function commitBloodlineTransaction(operation,successMessage){
  if(!profileWriterLease||state.gamePhase!==GAME_PHASES.BLOODLINE)return null;
  const draft=normaliseProfileV2(profile);let result;
  try{result=operation(draft)}catch(error){renderBloodline(String(error?.message||error));return null}
  if(!result.applied){renderBloodline(result.reason);return result}
  try{persistProfileStrict(draft)}catch(error){reportProfileSaveError(error);renderBloodline("The Bloodline change was not saved. Close other game tabs and try again.");return null}
  renderBloodline(successMessage(result));chord(108,164,244);return result;
}

function buyBloodlineNode(nodeId){return commitBloodlineTransaction(draft=>purchaseBloodlineNode(draft,nodeId),result=>`${result.node.name} awakened. ${result.balance} Blood Pack${result.balance===1?"":"s"} remain.`)}
function undoBloodline(){return commitBloodlineTransaction(draft=>undoBloodlinePurchase(draft),result=>`${result.node.name} returned to slumber. Its Blood Packs were refunded.`)}
function respecBloodlineTree(){return commitBloodlineTransaction(draft=>respecBloodline(draft),result=>`Bloodline reset. ${result.refunded} Blood Pack${result.refunded===1?"":"s"} refunded.`)}
function selectBloodlineBranch(branchId){if(!BLOODLINE_BRANCHES.some(branch=>branch.id===branchId))return;activeBloodlineBranch=branchId;renderBloodline();requestAnimationFrame(()=>document.querySelector(`[data-bloodline-tab="${branchId}"]`)?.focus())}

function renderTalentLoadout(message=""){
  const selected=profile.bloodline.loadout;
  $("loadoutSlots").replaceChildren(...Array.from({length:MAX_TALENT_SLOTS},(_,index)=>{const technique=TALENT_TECHNIQUES.find(item=>item.id===selected[index]);const slot=document.createElement("div");slot.className="loadout-slot";slot.innerHTML=technique?`<b>Slot ${index+1} · ${technique.name}</b><span>${technique.key} · selected and ready to enter the next night</span>`:`<b>Slot ${index+1} · Empty</b><span>Select an unlocked technique below</span>`;return slot}));
  $("techniqueGrid").replaceChildren(...TALENT_TECHNIQUES.map(technique=>{const unlocked=isTechniqueUnlocked(profile,technique.id),active=selected.includes(technique.id),card=document.createElement("article");card.className=`technique-card ${active?"selected":unlocked?"owned":"locked"}`;const stateLabel=active?"Selected":unlocked?"Owned · available":"Locked";card.innerHTML=`<div class="eyebrow">${technique.key} · ${stateLabel}</div><h3>${technique.name}</h3><p>${technique.description}</p><div class="status">Prerequisite: ${technique.prerequisite}</div><button class="${active?"primary":"secondary"}" data-technique="${technique.id}" ${unlocked?"":"disabled"}>${active?"Remove from loadout":unlocked?"Select technique":"Prerequisite unmet"}</button>`;return card}));
  document.querySelectorAll("[data-technique]").forEach(button=>button.addEventListener("click",()=>changeTalentLoadout(button.dataset.technique)));
  $("loadoutStatus").textContent=message||`${selected.length}/${MAX_TALENT_SLOTS} signature slots selected. Every change saves immediately and applies to the next run.`;
}

function openTalentLoadout(){if(!profileWriterLease||state.gamePhase!==GAME_PHASES.COFFIN_HUB)return;hideDialog("coffinHub",false);state.gamePhase=GAME_PHASES.LOADOUT;renderTalentLoadout();showDialog("loadoutModal",'[data-technique]:not([disabled]), #loadoutCloseBtn')}
function closeTalentLoadout(){if(state.gamePhase!==GAME_PHASES.LOADOUT)return;hideDialog("loadoutModal",false);state.gamePhase=GAME_PHASES.COFFIN_HUB;renderCoffinHub();showDialog("coffinHub","#loadoutBtn")}
function changeTalentLoadout(techniqueId){if(!profileWriterLease||state.gamePhase!==GAME_PHASES.LOADOUT)return;const draft=normaliseProfileV2(profile);let result;try{result=toggleTalentTechnique(draft,techniqueId);persistProfileStrict(draft)}catch(error){renderTalentLoadout(String(error?.message||error));return}const technique=TALENT_TECHNIQUES.find(item=>item.id===techniqueId);renderTalentLoadout(`${technique.name} ${result.selected?"selected":"removed"}. ${result.loadout.length}/${MAX_TALENT_SLOTS} slots occupied.`);chord(128,192,256)}

function acknowledgeCoffinOutcome(eventId){
  try{
    const draft=normaliseProfileV2(profile);
    if(clearPendingCoffinOutcome(draft,eventId))persistProfileStrict(draft);
    return true;
  }catch(error){reportProfileSaveError(error);$("coffinSummary").textContent="The coffin choice could not be saved. Keep this tab open and close other game tabs before trying again.";return false}
}

function coffinRise(){
  const pending=profile.campaign.pendingCoffinOutcome;
  if(!pending||!acknowledgeCoffinOutcome(pending.eventId))return;
  hideDialog("coffinHub",false);
  if(pending.mode==="hunt"&&profile.hunt.unlocked){startRun({mode:"hunt",huntDepth:pending.nextDepth||1});return}
  openCampaignMap();
}

function coffinLeave(){
  const pending=profile.campaign.pendingCoffinOutcome;
  if(pending&&!acknowledgeCoffinOutcome(pending.eventId))return;
  returnToTitle();
}

function continueCoffinOutcome(){
  const pending=profile.campaign.pendingCoffinOutcome;
  if(!pending)return;
  state.coffinOutcome=pending;state.restoredFrom=player?.maxBlood||112;
  if(player){player.blood=player.maxBlood;player.dashCd=0;player.thrallCd=0;player.mistCd=0;player.swarmCd=0}
  $("menu").classList.add("hidden");if(pending.endingUnlocked&&!profile.campaign.endingSeen){state.gamePhase=GAME_PHASES.ENDING;renderEnding();showDialog("endingModal","#endingContinueBtn");return}state.gamePhase=GAME_PHASES.COFFIN_HUB;renderCoffinHub();showDialog("coffinHub","#coffinRiseBtn");
}

function renderCampaignMap(){
  const grid=$("campaignGrid");
  grid.replaceChildren(...Object.values(CAMPAIGN_NIGHTS).map(contract=>{
    const night=Number(contract.id.split("-")[1]),cleared=Boolean(profile.campaign.clears[`night-${night}`]),unlocked=profile.campaign.unlockedNight>=night;
    const card=document.createElement("article");card.className=`night-card${unlocked?"":" locked"}`;
    const bossName=contract.bossId==="sol"?"Sol":contract.bossId==="elowen"?"Elowen":"Voss",objective=contract.bossId?`${contract.crossQuota} crosses · ${bossName} after dawn`:contract.lieutenantQuota?`${contract.crossQuota} crosses · ${contract.lieutenantQuota} ${contract.lieutenantName}`:`${contract.crossQuota} crosses · survive until dawn`;
    card.innerHTML=`<div class="night-number">Night ${night}${contract.bossId?" · Chapter boss":""}</div><h3>${contract.title}</h3><p>${contract.briefing}</p><button id="campaignNight${night}Btn" class="${unlocked?"primary":"secondary"}" ${unlocked?"":"disabled"}>${cleared?`Replay Night ${night}`:unlocked?`Enter Night ${night}`:"Locked"}</button><div class="status">${cleared?"Cleared · first reward secured":unlocked?`Playable · ${objective}`:`Clear Night ${night-1} to unlock`}</div>`;
    const button=card.querySelector("button");if(unlocked)button.addEventListener("click",()=>startRun({mode:"campaign",campaignNight:night}));
    return card;
  }));
  $("campaignBalance").textContent=`Blood Packs: ${profileBalance(profile)} · All fifteen nights keep the selected length fixed. ${profile.campaign.endingUnlocked?"Ending complete · Ascension Hunt unlocked.":profile.campaign.abilityUnlocks.swarm?"Swarm unlocked · defeat Archon Sol on Night 15.":profile.campaign.abilityUnlocks.mist?"Mist and Hunt unlocked · defeat Elowen on Night 10 for Swarm.":"Defeat Voss on Night 5 to unlock Mist and full Hunt."}`;
}

function openCampaignMap(){
  if(!profileWriterLease)return;
  state.gamePhase=GAME_PHASES.CAMPAIGN_MAP;state.running=false;state.paused=false;
  $("menu").classList.add("hidden");renderCampaignMap();showDialog("campaignMap","#campaignNight1Btn");
}

function currentRunOptions(){return{mode:state.mode,campaignNight:state.campaignNight||1,huntDepth:state.huntDepth||1,ascension:Boolean(state.ascension)}}

function startRun(options={}){
  if(!profileWriterLease)return;
  resetRun(options);state.gamePhase=GAME_PHASES.NIGHT_ACTIVE;state.running=true;
  $("bossWrap").style.display="none";$("bossWrap").classList.remove("active");
  $("menu").classList.add("hidden");
  for(const id of["campaignMap","resultModal","pauseModal","coffinTransition","coffinHub","bloodlineModal","loadoutModal","endingModal"])hideDialog(id,false);
  ensureAudio();toast(state.mode==="campaign"?`Campaign Night ${state.campaignNight} begins`:`Hunt Depth ${state.huntDepth} · ${state.huntMutator.name}${state.ascension?" · Ascension":""}`);chord(92,132,188);canvas.focus();lastFrame=performance.now();
}

function togglePause(force){if(!state.running||state.over||!$("pactModal").classList.contains("hidden"))return;const next=typeof force==="boolean"?force:!state.paused;if(!next&&!profileWriterLease)return;state.paused=next;if(state.paused)showDialog("pauseModal","#resumeBtn");else{hideDialog("pauseModal",false);canvas.focus()}}

function returnToTitle(){
  clearTimeout(coffinTransitionTimer);coffinTransitionTimer=null;
  clearThrallState();
  state.gamePhase=GAME_PHASES.MENU;state.running=false;state.paused=false;state.over=true;
  $("bossWrap").style.display="none";$("bossWrap").classList.remove("active");
  for(const id of["pauseModal","resultModal","campaignMap","coffinTransition","coffinHub","bloodlineModal","loadoutModal","endingModal"])hideDialog(id,false);
  $("menu").classList.remove("hidden");renderMenuProfile();$("startBtn").focus();
}

function renderScores(){const lines=profile.scores.slice(0,5).map((score,index)=>`${index+1}. ${score.score} · ${score.grade} · ${score.time}s · ${score.mode||"legacy"}`);$("scoreList").textContent=lines.length?"Best nights\n"+lines.join("\n"):"No completed nights recorded."}

function renderMenuProfile(){
  if(!BUILD.platform){$("menuAchievements").innerHTML="";return}
  const campaign=$("gameMode").value==="campaign";
  $("seedField").classList.toggle("hidden",campaign);
  $("huntRiteField").classList.toggle("hidden",campaign);$("huntRite").disabled=!profile.hunt.ascensionUnlocked;if(!profile.hunt.ascensionUnlocked)$("huntRite").value="standard";
  const huntUnlocked=Boolean(profile.hunt.unlocked&&profile.campaign.clears["night-5"]);
  $("startBtn").textContent=campaign?"Open Campaign":huntUnlocked?"Begin Hunt":"Defeat Voss to Unlock Hunt";
  $("startBtn").disabled=!profileWriterLease||(!campaign&&!huntUnlocked);
  $("continueCoffinBtn").classList.toggle("hidden",!profile.campaign.pendingCoffinOutcome);
  $("contrastSettingWrap").classList.remove("hidden");$("motionSettingWrap").classList.remove("hidden");
  const labels=profile.achievements.map(id=>ACHIEVEMENTS[id]);
  const nextDepth=Math.max(1,(profile.hunt.bestDepth||0)+1),nextBoss=Math.ceil(nextDepth/5)*5,mutator=huntMutatorForDepth(nextDepth);
  $("menuAchievements").innerHTML=labels.map(label=>`<span class="badge">${label}</span>`).join("")+`<span class="status">Night Legacy: ${profile.totalRuns} runs, ${profile.totalWins} victories · ${profileBalance(profile)} Blood Packs · Hunt best ${profile.hunt.bestDepth||"—"}.${campaign?"":`\nNext depth ${nextDepth}: ${mutator.name} · boss at ${nextBoss} · Hunt awards score mastery, not repeat Blood Packs.${profile.hunt.ascensionUnlocked?" Ascension available.":""}`}</span>`;
}

function applySettings(options={}){profile.settings.audio=$("audioSetting").checked;profile.settings.shake=$("shakeSetting").checked;profile.settings.particles=$("particlesSetting").checked;if(BUILD.platform){profile.settings.contrast=$("contrastSetting").checked;profile.settings.reducedMotion=$("motionSetting").checked;document.body.classList.toggle("high-contrast",profile.settings.contrast);document.body.classList.toggle("reduce-motion",profile.settings.reducedMotion)}if(options.persist!==false)saveProfile()}

function renderAbilityState(id,status,cooldown,maxCooldown){
  const element=$(id+"Ability"),statusElement=$(id+"Status");
  for(const stateName of["ready","cooldown","insufficient","locked","cooling","unequipped","casting","capacity","no-target"])element.classList.remove(stateName);
  element.classList.add(status.state);if(status.state==="cooldown")element.classList.add("cooling");
  statusElement.textContent=status.label;element.title=status.label;element.setAttribute("aria-label",`${id} · ${status.label}`);
  const fill=element.querySelector(".ability-shade");if(fill)fill.style.height=status.state==="cooldown"?clamp(cooldown/maxCooldown*100,0,100)+"%":"0%";
  const touchButton=document.querySelector(`#touchControls [data-action="${id}"]`);if(touchButton){touchButton.classList.toggle("locked",status.state==="locked");touchButton.setAttribute("aria-disabled",String(!status.ready));touchButton.title=status.label}
}

function updateHud(){
  if(!player||!state)return;
  $("bloodText").textContent=`${Math.max(0,Math.ceil(player.blood))} / ${player.maxBlood}`;$("bloodFill").style.width=clamp(player.blood/player.maxBlood*100,0,100)+"%";
  $("xpText").textContent=`${Math.floor(player.xp)} / ${player.nextXp}`;$("xpFill").style.width=clamp(player.xp/player.nextXp*100,0,100)+"%";
  const remaining=Math.max(0,state.requiredCrosses-state.relicsBroken),lieutenantsRemaining=Math.max(0,state.requiredLieutenants-state.lieutenantsDefeated),dawnRemaining=Math.max(0,Math.ceil(state.dawn-state.time)),modeLabel=state.mode==="campaign"?`Campaign Night ${state.campaignNight}`:`Hunt Depth ${state.huntDepth}`;
  const bossName=bossDisplayName(),clearLabel=state.mode==="campaign"?`Night ${state.campaignNight}`:`Hunt Depth ${state.huntDepth}`;
  $("mission").textContent=state.bossActive?`Dawn phase: defeat ${bossName}. Victory is required to clear ${clearLabel}.`:remaining?`Break ${remaining} of ${state.requiredCrosses} warding crosses${state.requiredLieutenants?` and defeat ${lieutenantsRemaining} ${state.contract.lieutenantName}`:""} before dawn.`:lieutenantsRemaining?`Crosses broken. Defeat ${lieutenantsRemaining} ${state.contract.lieutenantName} before dawn.`:state.contract.bossId?`Objectives complete. Survive ${dawnRemaining}s; ${bossName} arrives after dawn.`:`All objectives complete. Survive ${dawnRemaining}s until dawn.`;
  $("stats").innerHTML=`${modeLabel} · Score ${Math.floor(state.score)}<br>${state.bossActive?"Post-dawn boss":`Time ${Math.floor(state.time)}s · Dawn ${dawnRemaining}s`}<br>Threat ${state.threat} · Crosses ${state.relicsBroken}/${state.requiredCrosses}${state.requiredLieutenants?`<br>Lieutenants ${state.lieutenantsDefeated}/${state.requiredLieutenants}`:""}${state.huntMutator?`<br>${state.huntMutator.name}${state.ascension?" · Ascension":""}`:""}<br>Combo x${player.combo} · Dominion ${player.level}`;
  $("toast").textContent=state.toast;$("toast").style.opacity=state.toastTime>0?"1":"0";
  renderAbilityState("feed",currentAbilityStatus("feed"),player.attackCd,.22);renderAbilityState("dash",currentAbilityStatus("dash"),player.dashCd,player.dashBase);renderAbilityState("createThrall",currentAbilityStatus("createThrall"),player.thrallCd,player.thrallBase);renderAbilityState("mist",currentAbilityStatus("mist"),player.mistCd,player.mistBase);renderAbilityState("swarm",currentAbilityStatus("swarm"),player.swarmCd,9.5);
  if(BUILD.polish){$("frenzyWrap").classList.remove("hidden");$("frenzyFill").style.width=clamp(state.frenzy*100,0,100)+"%";$("frenzyText").textContent=state.bloodMoon>0?state.bloodMoon.toFixed(1)+"s":Math.floor(state.frenzy*100)+"%"}
  if(boss&&!boss.dead){$("bossFill").style.width=clamp(boss.hp/boss.maxHp*100,0,100)+"%";$("bossPhase").textContent="Phase "+["","I","II","III"][boss.phase]}
}
