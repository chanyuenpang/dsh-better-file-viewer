import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorkspaceFiles,createDirectoryLoader} from '../src/directory-loader.mjs';
import {consumeFileRequest,filePathKey} from '../src/navigation.mjs';
import {createDiagnostics} from '../src/diagnostics.mjs';
function backend(){
 const calls=[];
 const files={list(sessionId,path,signal){return new Promise((resolve,reject)=>calls.push({sessionId,path,signal,resolve,reject}));}};
 const resolve=(index,entries=[])=>calls[index].resolve({ok:true,value:{entries,truncated:false}});
 return {files,calls,resolve};
}
const sessionId='test-session',cwd='G:/Work';
const entry=name=>({name,type:'directory'});
test('live service facade stays stable while forwarding receiver, arguments and abort signal',async()=>{
 let generation=0;const seen=[];
 const getFiles=()=>{const id=++generation;return {list(...args){seen.push({id,args,receiver:this});return Promise.resolve(id);},readBytes(...args){seen.push({id,args,receiver:this});return Promise.resolve(id);}};};
 assert.notEqual(getFiles(),getFiles());const facade=createWorkspaceFiles(getFiles),signal=new AbortController().signal;
 await facade.list(sessionId,cwd,signal);await facade.readBytes(sessionId,cwd+'/x.json',{},signal);
 assert.equal(seen.length,2);assert.notEqual(seen[0].id,seen[1].id);assert.equal(seen[0].args[2],signal);assert.equal(seen[1].args[3],signal);
 assert.equal(typeof seen[0].receiver.list,'function');assert.equal(Object.isFrozen(facade),true);
});
test('direct nested-file reveal loads every ancestor despite fresh service handles and acknowledgement',async()=>{
 const io=backend();let reads=0;const files=createWorkspaceFiles(()=>{reads++;return {...io.files};});
 const loader=createDirectoryLoader({files,sessionId});loader.start();
 const target=consumeFileRequest({view:'better-files',focus:cwd+'/a/b/file.md'},null,sessionId,cwd);
 const jobs=target.ancestors.map(path=>loader.load(path));
 // Acknowledging focus removes the request in the parent, not the facade/loader.
 assert.equal(io.calls.length,3);assert.equal(reads,3);assert.ok(io.calls.every(call=>!call.signal.aborted));
 io.resolve(2,[{name:'file.md',type:'file'}]);io.resolve(0,[entry('a')]);io.resolve(1,[entry('b')]);await Promise.all(jobs);
 for(const path of target.ancestors)assert.equal(loader.snapshot()[filePathKey(path)].status,'ready');
 assert.equal(loader.pendingCount(),0);loader.stop();
});
test('duplicate and Windows-equivalent requests share one pending read and ready cache',async()=>{
 const io=backend(),loader=createDirectoryLoader({files:io.files,sessionId});loader.start();
 const first=loader.load(cwd+'/a'),second=loader.load('g:\\work\\a');assert.equal(first,second);assert.equal(io.calls.length,1);
 io.resolve(0,[{name:'file10',type:'file'},entry('folder'),{name:'file2',type:'file'}]);await first;
 assert.deepEqual(loader.snapshot()[filePathKey(cwd+'/a')].entries.map(e=>e.name),['folder','file2','file10']);
 await loader.load(cwd+'/a');assert.equal(io.calls.length,1);loader.stop();
});
test('stop/start replays all interrupted ancestors and stale resolutions cannot erase replacement tasks',async()=>{
 const io=backend(),loader=createDirectoryLoader({files:io.files,sessionId});loader.start();
 const paths=[cwd,cwd+'/a',cwd+'/a/b'],old=paths.map(path=>loader.load(path));loader.stop();
 assert.equal(loader.pendingCount(),0);assert.ok(io.calls.every(call=>call.signal.aborted));
 for(const path of paths)assert.equal(loader.snapshot()[filePathKey(path)].status,'idle');
 loader.start();const fresh=paths.map(path=>loader.load(path));assert.equal(io.calls.length,6);
 for(let i=0;i<3;i++)io.resolve(i,[entry('stale')]);await Promise.all(old);assert.equal(loader.pendingCount(),3);
 for(let i=3;i<6;i++)io.resolve(i,[entry('fresh')]);await Promise.all(fresh);
 for(const path of paths){assert.equal(loader.snapshot()[filePathKey(path)].status,'ready');assert.equal(loader.snapshot()[filePathKey(path)].entries[0].name,'fresh');}
 assert.equal(loader.pendingCount(),0);loader.stop();
});
test('forced refresh cannot be overwritten or removed by an older noncooperative request',async()=>{
 const io=backend(),loader=createDirectoryLoader({files:io.files,sessionId});loader.start();
 const old=loader.load(cwd),fresh=loader.load(cwd,true);assert.equal(io.calls[0].signal.aborted,true);
 io.resolve(0,[entry('old')]);await old;assert.equal(loader.pendingCount(),1);assert.equal(loader.snapshot()[filePathKey(cwd)].status,'loading');
 io.resolve(1,[entry('new')]);await fresh;assert.equal(loader.snapshot()[filePathKey(cwd)].entries[0].name,'new');loader.stop();
});
test('failures are explicit and retry/empty completion leave loading correctly',async()=>{
 const io=backend(),loader=createDirectoryLoader({files:io.files,sessionId});loader.start();
 const bad=loader.load(cwd);io.calls[0].reject(new Error('Permission denied'));await bad;
 assert.equal(loader.snapshot()[filePathKey(cwd)].status,'failed');assert.match(loader.snapshot()[filePathKey(cwd)].error,/Permission denied/);
 const retry=loader.load(cwd);io.resolve(1);await retry;
 assert.equal(loader.snapshot()[filePathKey(cwd)].status,'ready');assert.deepEqual(loader.snapshot()[filePathKey(cwd)].entries,[]);loader.stop();
});
test('unmount blocks late publication and queued directories restart without another focus request',async()=>{
 const io=backend();let updates=0;const loader=createDirectoryLoader({files:io.files,sessionId,onChange:()=>updates++});
 await loader.load(cwd+'/a');assert.equal(io.calls.length,0);loader.start();assert.equal(io.calls.length,1);
 const old=loader.load(cwd+'/a');loader.stop();const stopped=updates;io.resolve(0,[entry('late')]);await old;assert.equal(updates,stopped);
 loader.start();const fresh=loader.load(cwd+'/a');io.resolve(1);await fresh;assert.equal(loader.snapshot()[filePathKey(cwd+'/a')].status,'ready');loader.stop();
});
test('view memoizes the facade instead of passing a fresh traced service to loading effects',async()=>{
 const source=await readFile(new URL('../src/client.jsx',import.meta.url),'utf8');
 assert.match(source,/useMemo\(\(\)=>createWorkspaceFiles\(\(\)=>ctx.remote.workspaceFiles\),\[\]\)/);
 assert.doesNotMatch(source,/files=\{ctx.remote.workspaceFiles\}/);assert.match(source,/directoryLoader.start\(\)/);assert.match(source,/return\(\)=>directoryLoader.stop\(\)/);
});
test('runtime handle-identity diagnostics work before a file view has mounted',()=>{
 const snapshot=createDiagnostics({workspaceFilesHandleStable:false}).snapshot(sessionId);
 assert.equal(snapshot.observed,false);assert.equal(snapshot.runtime.workspaceFilesHandleStable,false);
});
