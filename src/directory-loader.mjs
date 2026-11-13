import {filePathKey} from './navigation.mjs';
import {unwrap,sortedEntries,errorMessage} from './core.mjs';
// Cordis service reads may produce a fresh traced handle. Keep React's facade
// stable, but resolve the live service on every operation and retain its receiver.
export function createWorkspaceFiles(getFiles){
  return Object.freeze({list(...args){return getFiles().list(...args);},readBytes(...args){return getFiles().readBytes(...args);}});
}
export function createDirectoryLoader({files,sessionId,onChange=()=>{},onEvent=()=>{}}){
  let active=false,levels={};
  const pending=new Map(),wanted=new Map();
  const report=(event,path,extra={})=>onEvent(event,{directoryPath:path,pendingDirectories:pending.size,...extra});
  function publish(key,value){levels={...levels,[key]:value};if(active)onChange(levels);}
  function load(path,force=false){
    const key=filePathKey(path);wanted.set(key,path);
    if(!active)return Promise.resolve();
    if(!force){if(pending.has(key))return pending.get(key).promise;if(levels[key]?.status==='ready')return Promise.resolve(levels[key]);}
    pending.get(key)?.controller.abort();
    const task={controller:new AbortController(),promise:null};pending.set(key,task);
    const current=()=>active&&!task.controller.signal.aborted&&pending.get(key)===task;
    publish(key,{...levels[key],status:'loading'});report('directory-request-start',path);
    task.promise=(async()=>{
      try{
        const result=unwrap(await files.list(sessionId,path,task.controller.signal));
        if(!current())return;
        const value={status:'ready',entries:sortedEntries(result.entries),truncated:result.truncated};
        pending.delete(key);publish(key,value);report('directory-request-ready',path,{directoryEntries:value.entries.length});return value;
      }catch(error){
        if(!current())return;
        const value={status:'failed',error:errorMessage(error)};pending.delete(key);publish(key,value);report('directory-request-failed',path,{directoryError:value.error});return value;
      }finally{if(pending.get(key)===task)pending.delete(key);}
    })();
    return task.promise;
  }
  function start(){
    if(active)return;
    active=true;onChange(levels);
    // React effect replay must restart every interrupted ancestor, not only cwd.
    for(const path of wanted.values())load(path);
  }
  function stop(){
    active=false;
    const canceled=[...pending];pending.clear();
    for(const [key,task]of canceled){task.controller.abort();if(levels[key]?.status==='loading')publish(key,{...levels[key],status:'idle'});report('directory-request-aborted',wanted.get(key));}
  }
  return {load,start,stop,snapshot:()=>levels,pendingCount:()=>pending.size};
}
