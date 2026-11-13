// Decode only the exact authenticated media route emitted by Chat.fileMediaUrl.
// Never infer filesystem paths from blob/data URLs, captions or external hosts.
export function localImageFilePath(src,base){
  if(typeof src!=='string'||!src||/^(?:blob|data):/i.test(src))return null;
  try{
    const app=new URL(base),url=new URL(src,app),route=new URL('api/file',app);
    if(!['http:','https:','dsh-app:'].includes(app.protocol)||app.protocol==='dsh-app:'&&app.host!=='app')return null;
    if(url.protocol!==app.protocol||url.host!==app.host||url.pathname!==route.pathname||url.username||url.password)return null;
    const paths=url.searchParams.getAll('path');if(paths.length!==1)return null;
    const path=paths[0];
    if(!/^(?:[A-Za-z]:[\\/]|\/)/.test(path)||/^[\\/]{2}/.test(path)||/[\u0000-\u001f\u007f]/.test(path))return null;
    return path;
  }catch{return null;}
}
export function imageSourceKind(src,base){
  if(localImageFilePath(src,base))return 'host-file';
  if(!src)return 'none';
  try{const url=new URL(src,base);return ['blob:','data:'].includes(url.protocol)?url.protocol.slice(0,-1):'other-url';}catch{return 'invalid';}
}
