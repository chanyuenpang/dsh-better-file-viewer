import test from 'node:test';
import assert from 'node:assert/strict';
import { fileAddress, layoutStyle, sortedEntries, decodeJson, createLimiter, unwrap, createPreviewInstance } from '../src/core.mjs';
test('session file addresses preserve authority and encode each path segment',()=>{
  assert.equal(fileAddress('session #1','G:\\work\\A B\\x#1.md'),'dsh-resource://file/session/session%20%231/G:/work/A%20B/x%231.md');
  assert.equal(fileAddress('s','../outside/file.md'),'dsh-resource://file/session/s/../outside/file.md');
});
test('four layouts preserve tree percentage when reversing pane order',()=>{
  assert.equal(layoutStyle('left',27).gridTemplateColumns,'minmax(0, 27fr) 6px minmax(0, 73fr)');
  assert.equal(layoutStyle('right',27).gridTemplateColumns,'minmax(0, 73fr) 6px minmax(0, 27fr)');
  assert.equal(layoutStyle('top',30).gridTemplateRows,'minmax(0, 30fr) 6px minmax(0, 70fr)');
  assert.equal(layoutStyle('bottom',30).gridTemplateRows,'minmax(0, 70fr) 6px minmax(0, 30fr)');
  assert.match(layoutStyle('left',1).gridTemplateColumns,/15fr/);
});
test('directories sort before naturally ordered files without changing input',()=>{
  const input=[{name:'10.png',type:'file'},{name:'z',type:'directory'},{name:'2.png',type:'file'}];
  assert.deepEqual(sortedEntries(input).map(x=>x.name),['z','2.png','10.png']);
  assert.equal(input[0].name,'10.png');
});
test('JSON supports scalar roots and never replaces invalid JSON with an object',()=>{
  const bytes=s=>new TextEncoder().encode(s);
  for(const value of [null,false,0,'text',[],{a:1}])assert.deepEqual(decodeJson(bytes(JSON.stringify(value))).value,value);
  assert.equal(decodeJson(bytes('{bad')).text,'{bad');
  assert.ok(decodeJson(bytes('{bad')).error);
  assert.throws(()=>decodeJson(new Uint8Array([0xff])));
});
test('file service failures stay explicit',()=>{
  assert.equal(unwrap({ok:true,value:7}),7);
  assert.throws(()=>unwrap({ok:false,error:{message:'access denied'}}),/access denied/);
  assert.throws(()=>unwrap({}),/Unexpected/);
});
test('preview instances cancel independently without sidebar state',()=>{
  const a=createPreviewInstance(fileAddress('A','file.md')),b=createPreviewInstance(fileAddress('B','file.md'));
  assert.notEqual(a.usePreviewInfo().occurrence.id,b.usePreviewInfo().occurrence.id);
  let disposed=false;a.signal.addEventListener('abort',()=>{disposed=true;});
  const old=()=>{},fresh=()=>{};
  const release=a.usePreviewInfo().occurrence.actions.bindCommands({refresh:old});
  a.usePreviewInfo().occurrence.actions.bindCommands({refresh:fresh});release();
  assert.equal(a.commands.get('refresh'),fresh);
  a.dispose();a.dispose();assert.ok(disposed);assert.ok(a.signal.aborted);assert.equal(a.commands.size,0);assert.equal(b.signal.aborted,false);b.dispose();
});
test('thumbnail limiter bounds concurrent work and cancels queued readers',async()=>{
  const limit=createLimiter(2);let active=0,max=0;const releases=[];
  const run=()=>new Promise(resolve=>{active++;max=Math.max(max,active);releases.push(()=>{active--;resolve();});});
  const a=new AbortController(),b=new AbortController(),c=new AbortController();
  const p1=limit(run,a.signal),p2=limit(run,b.signal),p3=limit(run,c.signal);
  await Promise.resolve();c.abort();await assert.rejects(p3);
  releases.splice(0).forEach(f=>f());await Promise.all([p1,p2]);assert.equal(max,2);
});
