// Read-only, bounded diagnostics for this plugin's own view. No global click
// interception, sidebar writes, conversation text or file contents are collected.
export const DIAGNOSTIC_BUILD='0.1.12';
function safe(value,depth=0){
  if(value===null||typeof value==='boolean'||typeof value==='number')return value;
  if(typeof value==='string'){
    const text=value.slice(0,2048);
    if(/^https?:\/\//i.test(text)){try{const url=new URL(text);return url.origin+url.pathname;}catch{return '[URL]';}}
    return text;
  }
  if(value===undefined)return null;
  if(depth>=3)return '[nested]';
  if(Array.isArray(value))return value.slice(0,10).map(v=>safe(v,depth+1));
  if(typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,20).map(([k,v])=>[k,/token|secret|password|credential/i.test(k)?'[redacted]':safe(v,depth+1)]));
  return `[${typeof value}]`;
}
export function createDiagnostics(runtime){
  const sessions=new Map();let sequence=0,lastImageClick=null;const recentImageClicks=[];
  function record(sessionId,event,patch={}){
    const data=safe(patch),id=++sequence;
    if(event==='chat-image-click'){lastImageClick={sequence:id,sessionId:sessionId||null,...data.imageClick};recentImageClicks.push(lastImageClick);if(recentImageClicks.length>6)recentImageClicks.shift();}
    if(!sessionId)return;
    const previous=sessions.get(sessionId)||{state:{},events:[]};
    const entry={sequence:id,event,...data};
    sessions.delete(sessionId);
    sessions.set(sessionId,{state:{...previous.state,...data},events:[...previous.events,entry].slice(-12)});
    // Keep only the most recently observed 16 sessions; no persistence.
    if(sessions.size>16)sessions.delete(sessions.keys().next().value);
  }
  function snapshot(sessionId){return {build:DIAGNOSTIC_BUILD,sessionId,observed:sessions.has(sessionId),observedSessions:[...sessions.keys()],lastImageClick,recentImageClicks:[...recentImageClicks],...(runtime?{runtime:safe(runtime)}:{}),...(sessions.get(sessionId)||{state:null,events:[]})};}
  return {record,snapshot};
}
export function registerDiagnostics(ctx,diagnostics){
  ctx.inject(['cordisInspect'],scope=>scope.effect(()=>{
    const registry=scope.get('cordisInspect');
    const manifest={id:'BetterFilesDiagnostics',description:'Read-only file-view and image-click metadata; no navigation or file-content reads.',methods:[{name:'snapshot',description:'Return Session state (12 events), 16 observed Session IDs, and this page’s last 6 image-click metadata records.',inputSchema:{type:'object',properties:{sessionId:{type:'string',description:'Optional viewed session ID; defaults to the requesting session.'}},additionalProperties:false},outputSchema:{description:'Build/runtime, Session state and recent image-click metadata including unscoped portals; no image bytes or conversation text.'}}]};
    const query=(method,input,request)=>{if(method!=='snapshot')throw new Error('Unknown diagnostics method');return diagnostics.snapshot(input?.sessionId||request.sessionId);};
    const dispose=registry.register({manifest,query});let focusedDispose;
    const focused=()=>{
      if(document.hasFocus()){if(!focusedDispose)focusedDispose=registry.register({manifest:{...manifest,id:'BetterFilesDiagnosticsFocused',description:'The focused page’s read-only file/image diagnostics; avoids a background tab answering first.'},query});}
      else{focusedDispose?.();focusedDispose=undefined;}
    };
    const browser=typeof window!=='undefined'&&typeof document!=='undefined';
    if(browser){window.addEventListener('focus',focused);window.addEventListener('blur',focused);focused();}
    return()=>{if(browser){window.removeEventListener('focus',focused);window.removeEventListener('blur',focused);}focusedDispose?.();dispose();};
  },'better-files: read-only view diagnostics'));
}
