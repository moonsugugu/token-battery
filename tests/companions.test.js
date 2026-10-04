const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../renderer/companions');
const opts = {theme:'mascot',claude:true,codex:true,since:{claude:100,codex:100}};
const event = (service,tokens,at=101) => ({service,tokens,at});

test('actual tokens belong only to enabled friends in the current theme, after activation',()=>{
 const state={};
 C.earn(state,[event('claude',500000,99),event('claude',600000),event('codex',800000)],{...opts,codex:false});
 assert.equal(C.view(state,'mascot','claude').tokens,600000);
 assert.equal(C.view(state,'mascot','codex').tokens,0);
 assert.equal(C.view(state,'mascot','claude').unlocked,1);
 C.earn(state,[event('claude',1000000,110),event('claude',700000,120)],{...opts,theme:'garden',since:{claude:115,codex:115}});
 assert.equal(C.view(state,'garden','claude').tokens,700000);
 assert.equal(C.view(state,'mascot','claude').tokens,600000);
});

test('all milestones use token counts; old designs remain selectable while earning',()=>{
 const state={};
 const milestones=[0,600000,3600000,12000000,30000000];
 let total=0;
 for(let rank=1;rank<5;rank++){
  const delta=milestones[rank]-total;
  const unlocked=C.earn(state,[event('claude',delta)],opts);
  total+=delta;
  assert.equal(C.view(state,'mascot','claude').unlocked,rank);
  assert.equal(unlocked[0].to,rank);
  if(rank===1) assert.ok(C.select(state,'mascot','claude',0));
 }
 assert.equal(C.view(state,'mascot','claude').selected,0);
 assert.equal(C.view(state,'mascot','claude').progress,100);
 assert.ok(C.select(state,'mascot','claude',null));
 assert.equal(C.view(state,'mascot','claude').selected,4);
 assert.equal(C.select(state,'mascot','codex',1),false);
 assert.equal(C.select(state,'garden','claude',1),false);
 assert.equal(C.select(state,'unknown','claude',0),false);
});

test('migration preserves achievements without fabricating measured token counts',()=>{
 const state=C.migrate({friends:{'mascot:claude':{points:220,selected:1}},meters:{claude:{high:80}}});
 const friend=C.view(state,'mascot','claude');
 assert.equal(friend.tokens,0);
 assert.equal(friend.unlocked,3);
 assert.equal(friend.selected,1);
 assert.equal(state.meters,undefined);
 assert.equal(state.friends['mascot:claude'].points,undefined);
});

test('changing personal goals never removes earned designs and rejects invalid targets',()=>{
 const state={};
 C.earn(state,[event('claude',3600000)],opts);
 assert.equal(C.setTarget(state,'claude',300000000),true);
 assert.equal(C.view(state,'mascot','claude').unlocked,2);
 for(const target of [0,-1,Infinity,NaN,1.5,10000000001]) assert.equal(C.setTarget(state,'claude',target),false);
 assert.equal(C.setTarget(state,'manual',30000000),false);
 assert.equal(C.setTarget(state,'codex',1000000),true);
 assert.equal(C.view(state,'mascot','codex').goal,1000000);
});

test('concurrent timer ticks apply a returned log batch exactly once',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../main.js'),'utf8');
 let resolve,reads=0,awards=0;
 const pending=new Promise(r=>resolve=r);
 const context=vm.createContext({tokenTracker:{poll(){reads++;return pending},status(){return {}}},store:{companions:{},theme:'mascot'},tokenSince:opts.since,Companions:{earn(){awards++;return []}},saveStore(){},win:null});
 vm.runInContext(source.slice(source.indexOf('let tokenRequest = null;'),source.indexOf('async function readUsage()')),context);
 const first=vm.runInContext('refreshTokens()',context),second=vm.runInContext('refreshTokens()',context);
 assert.equal(first,second);resolve([event('claude',100)]);await first;
 assert.equal(reads,1);assert.equal(awards,1);
});

test('all 500 theme/service/stage/battery combinations select real artwork and correct columns',()=>{
 const context=vm.createContext({});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../renderer/characters.js'),'utf8'),context);
 const states=['fresh','ok','tired','dizzy','sleep'];
 for(const theme of C.themes)for(const service of ['claude','codex'])for(let rank=0;rank<5;rank++)for(const state of states){
  const html=vm.runInContext(`drawCharacter('${theme}','${service}','${state}',null,${rank})`,context);
  assert.match(html,new RegExp(`st-${state}`));
  const image=html.match(/url\('([^']+)'\)/)[1];
  assert.ok(fs.existsSync(path.join(__dirname,'../renderer',image)),image);
  if(rank) {
   assert.match(html,/evolution-sprite/);
   const separate=['engine','industrial'].includes(theme), rows=separate?4:8;
   const row=(separate?0:service==='codex'?4:0)+rank-1;
   assert.ok(html.includes(`--sprite-rows:${rows*100}%;--sprite-row:${row*100/(rows-1)}%`));
   const png=fs.readFileSync(path.join(__dirname,'../renderer',image));
   assert.ok(Math.abs(png.readUInt32BE(16)/5-png.readUInt32BE(20)/rows)<1,'square atlas cells');
  }else assert.match(image,/crew-animation/);
 }
});
