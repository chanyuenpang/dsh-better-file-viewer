import { VIEW_ID, joinPath } from './core.mjs';
const RESOURCE_PREFIX='dsh-resource://file/';
export function normalizePath(value,base='') {
  if(typeof value!=='string'||!value||/[\u0000-\u001f]/.test(value))throw new Error('Invalid file path');
  let path=value.replaceAll('\\','/');
  const absolute=/^(?:[A-Za-z]:\/|\/)/.test(path);
  if(!absolute&&base)path=base.replaceAll('\\','/').replace(/\/+$/,'')+'/'+path;
  if(/^[A-Za-z]:[^/]/.test(path))throw new Error('Drive-relative file paths are not supported');
  const drive=path.match(/^[A-Za-z]:\//)?.[0];
  const prefix=drive|| (path.startsWith('//')?'//':path.startsWith('/')?'/':'');
  const parts=path.slice(prefix.length).split('/');const normalized=[];
  for(const part of parts){if(!part||part==='.')continue;if(part==='..'){if(normalized.length&&normalized.at(-1)!=='..')normalized.pop();else if(!prefix)normalized.push(part);}else normalized.push(part);}
  return prefix+normalized.join('/');
}
export function filePathKey(value){const normalized=normalizePath(value);return /^(?:[A-Za-z]:\/|\/\/)/.test(normalized)?normalized.toLowerCase():normalized;}
export function sameFilePath(a,b){return typeof a==='string'&&typeof b==='string'&&filePathKey(a)===filePathKey(b);}
function decode(value){try{return decodeURIComponent(value);}catch{throw new Error('Malformed encoded file address');}}
function lineFrom(hash){const match=hash?.match(/^#?L?(\d+)(?:[-:]L?\d+)?$/i);return match&&Number(match[1])>0?Number(match[1]):undefined;}
export function parseFileFocus(focus,sessionId,cwd) {
  if(typeof focus!=='string'||!focus.trim())throw new Error('Empty file navigation request');
  let target=focus.trim(),line;
  if(target.startsWith('{')){
    let payload;try{payload=JSON.parse(target);}catch{throw new Error('Invalid file navigation payload');}
    if(payload.sessionId!==undefined&&payload.sessionId!==sessionId)throw new Error('File request belongs to another session');
    target=payload.address??payload.path;
    if(typeof target!=='string'||!target)throw new Error('File navigation payload has no address or path');
    if(Number.isSafeInteger(payload.line)&&payload.line>0)line=payload.line;
  }
  let path;
  if(target.startsWith(RESOURCE_PREFIX)){
    const suffix=target.slice(RESOURCE_PREFIX.length);
    const end=suffix.search(/[?#]/);const address=end<0?suffix:suffix.slice(0,end);
    line??=lineFrom(target.match(/#.*$/)?.[0]);
    const parts=address.split('/');const scope=parts.shift();
    if(scope==='session'){
      if(decode(parts.shift()||'')!==sessionId)throw new Error('File request belongs to another session');
      path=parts.map(decode).join('/');
    }else if(scope==='absolute'){
      const unc=parts[0]===''&&parts.length>1;
      const decoded=(unc?parts.slice(1):parts).map(decode).join('/');
      path=unc?'//'+decoded:/^[A-Za-z]:\//.test(decoded)?decoded:'/'+decoded;
    }else throw new Error('Unsupported file resource scope');
  }else if(target.startsWith('file:')){
    let url;try{url=new URL(target);}catch{throw new Error('Invalid file URL');}
    path=decode(url.pathname);if(/^\/[A-Za-z]:\//.test(path))path=path.slice(1);
    if(url.hostname&&url.hostname!=='localhost')path='//'+url.hostname+path;
    line??=lineFrom(url.hash);
  }else{
    if(/^[a-z][a-z\d+.-]*:/i.test(target)&&!(/^[A-Za-z]:[\\/]/.test(target)))throw new Error('Navigation target is not a local file');
    path=target;
  }
  return {path:normalizePath(path,cwd),params:line===undefined?undefined:{line}};
}
export function revealFile(path,cwd){
  const root=normalizePath(cwd);const file=normalizePath(path,cwd);
  const insensitive=/^(?:[A-Za-z]:\/|\/\/)/.test(root);
  const comparison=s=>insensitive?s.toLowerCase():s;
  const prefix=root.endsWith('/')?root:root+'/';
  if(!comparison(file).startsWith(comparison(prefix)))return {path:file,folder:cwd,ancestors:[cwd],insideWorkspace:false};
  const relative=file.slice(prefix.length).split('/');const name=relative.pop();
  let folder=cwd;const ancestors=[cwd];
  for(const part of relative){folder=joinPath(folder,part);ancestors.push(folder);}
  return {path:joinPath(folder,name),folder,ancestors,insideWorkspace:true};
}
export function consumeFileRequest(request,previous,sessionId,cwd){
  if(!request||request===previous||request.view!==VIEW_ID)return null;
  const target=parseFileFocus(request.focus,sessionId,cwd);
  return {...revealFile(target.path,cwd),params:target.params};
}
