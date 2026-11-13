import {joinPath} from './core.mjs';
import {normalizePath,filePathKey,sameFilePath} from './navigation.mjs';
// A directory chain maps to Miller columns: one list per level, never one
// vertically-indented list containing the entire expanded hierarchy.
export function directoryChain(cwd,folder){
  const root=normalizePath(cwd),current=normalizePath(folder);
  if(sameFilePath(root,current))return [cwd];
  const prefix=root.endsWith('/')?root:root+'/';
  if(!filePathKey(current).startsWith(filePathKey(prefix).replace(/\/$/,'')+'/'))return [cwd];
  let path=cwd;const chain=[cwd];
  for(const part of current.slice(prefix.length).split('/')){if(!part)continue;path=joinPath(path,part);chain.push(path);}
  return chain;
}
export function columnFolderTarget(cwd,currentFolder,parent,target){
  return directoryChain(cwd,currentFolder).some(path=>sameFilePath(path,target))?parent:target;
}
export function toggleExpanded(previous,path,mode='toggle'){
  const next=new Set(previous),key=filePathKey(path);
  if(mode==='close'||mode==='toggle'&&next.has(key))next.delete(key);else next.add(key);
  return next;
}
export function galleryState(level,imageCount){
  if(level?.status==='failed')return 'error';
  if(level?.status!=='ready')return 'loading';
  return imageCount>0?'gallery':'blank';
}
