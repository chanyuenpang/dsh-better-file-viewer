import { VIEW_ID } from './core.mjs';
import { localImageFilePath, imageSourceKind } from './chat-image-source.mjs';
function canCapture(facts){return !!facts.sessionId&&facts.inConversation&&!facts.inFilesView&&!facts.inComposer&&facts.button===0&&!facts.ctrlKey&&!facts.metaKey&&!facts.altKey&&!facts.shiftKey&&!facts.defaultPrevented;}
export function fileFocusFromClick(facts){
  if(!canCapture(facts))return null;
  let target,line;
  if(facts.tag==='A')target=facts.href;
  else if(facts.tag==='BUTTON'&&facts.fileButton){
    target=facts.title;
    if(!target&&facts.derivedFile){target=facts.derivedFile.path;line=facts.derivedFile.line;}
  }
  if(typeof target!=='string'||!target.trim())return null;
  target=target.trim();
  if(/^[#?]/.test(target))return null;
  if(/^[a-z][a-z\d+.-]*:/i.test(target)&&!/^([A-Za-z]:[\\/]|file:|dsh-resource:\/\/file\/)/.test(target))return null;
  // Plain hrefs are URL-encoded, while a file button title is a native path.
  // Button lines only come from the validated native parser, never a caption.
  if(facts.tag==='A'&&!/^file:|^dsh-resource:/i.test(target)){
    const match=target.match(/#L(\d+)(?:-L?\d+)?$/i);
    if(match){line=Number(match[1]);target=target.slice(0,match.index);}
    try{target=decodeURIComponent(target);}catch{return null;}
  }
  if(facts.tag==='A'&&!/^(?:[A-Za-z]:[\\/]|\/|\.\.?[\\/]|file:|dsh-resource:\/\/file\/)/.test(target)&&!/[\\/]|\.[\w-]+$/.test(target))return null;
  return JSON.stringify({sessionId:facts.sessionId,address:target,...(line>0?{line}:{})});
}
export function createPendingFileRequests({now=Date.now,ttl=5000}={}){
  const pending=new Map();let sequence=0;
  return {
    capture(sessionId,focus,origin){
      const request={view:VIEW_ID,focus};
      const entry={sequence:++sequence,created:now(),origin,request};
      pending.delete(sessionId);pending.set(sessionId,entry);
      if(pending.size>16)pending.delete(pending.keys().next().value);
      return entry;
    },
    // Pure peek is safe in React render/StrictMode. Removal is explicit on effect.
    peek(sessionId,origin){const entry=pending.get(sessionId);return entry&&now()-entry.created<=ttl&&(!origin||entry.origin===origin)?entry:null;},
    acknowledge(sessionId,id){if(pending.get(sessionId)?.sequence===id)pending.delete(sessionId);},
    clear(){pending.clear();}
  };
}
export function observeConversationFileClicks(ctx,pending,diagnostics,resolveImageFile){
  ctx.effect(()=>{
    let lastPointer;
    function capture(event){
      if(!event.isTrusted)return;
      const node=event.target?.nodeType===1?event.target:event.target?.parentElement;
      const control=node?.closest('a[href],button');
      const scope=control||node;
      const root=scope?.closest('[data-conversation-session]');
      const region=scope?.closest('[data-conversation-region]')?.getAttribute('data-conversation-region');
      const facts={sessionId:root?.getAttribute('data-conversation-session'),inConversation:region==='chat',inComposer:region==='composer',inFilesView:!!scope?.closest('.bfv-view'),tag:control?.tagName,href:control?.getAttribute('href'),title:control?.getAttribute('title'),fileButton:[...(control?.classList||[])].some(name=>/(?:^|_)fileLink(?:_|$)/.test(name)),button:event.button,ctrlKey:event.ctrlKey,metaKey:event.metaKey,altKey:event.altKey,shiftKey:event.shiftKey,defaultPrevented:event.defaultPrevented};
      const path=event.composedPath?.()||[];
      const image=path.find(item=>item?.tagName==='IMG')||node?.closest('img')||control?.querySelector('img');
      const imageControl=control||node?.closest('[role="button"]')||node;
      const classes=[...(imageControl?.classList||[])];
      const imageButton=classes.some(name=>/(?:^|_)imageButton(?:_|$)/.test(name));
      const imageCandidate=image||imageButton||facts.fileButton&&!facts.title||node?.tagName==='CANVAS'||classes.some(name=>/image|attachment|preview/i.test(name));
      // Diagnostic-only coverage includes attachment seats and portals, which may
      // not carry the Chat region or even a Session ancestor. It never navigates.
      if(!facts.inComposer&&!facts.inFilesView&&imageCandidate){
        const src=image?.getAttribute('src');
        diagnostics.record(facts.sessionId,'chat-image-click',{imageClick:{event:event.type,region:region||null,targetTag:node?.tagName,controlTag:imageControl?.tagName,imageButton,fileButton:facts.fileButton,hasImage:!!image,hasTitle:!!facts.title,hasHref:!!facts.href,sourceKind:imageSourceKind(src,document.baseURI),localPath:localImageFilePath(src,document.baseURI),controlClasses:classes.slice(0,8),imageDataAttributes:(image?.getAttributeNames?.()||[]).filter(name=>name.startsWith('data-')).slice(0,8),controlDataAttributes:(imageControl?.getAttributeNames?.()||[]).filter(name=>name.startsWith('data-')).slice(0,8)}});
      }
      if(canCapture(facts)&&facts.tag==='BUTTON'&&facts.fileButton&&!facts.title&&typeof resolveImageFile==='function')facts.derivedFile=resolveImageFile(facts,control,root);
      const focus=fileFocusFromClick(facts);
      // A separate human gesture (e.g. manually choosing the Files tab) must not
      // consume an old file click. Programmatic clicks do not clear the handoff.
      if(!focus){
        // A host capture handler may already have detached the old Chat subtree.
        // Preserve a matching pointer handoff rather than losing its Session root.
        if(event.type==='click'&&lastPointer&&lastPointer.control===control&&pending.peek(lastPointer.sessionId,lastPointer.origin)?.sequence===lastPointer.sequence)return;
        lastPointer=null;pending.clear();return;
      }
      const entry=pending.capture(facts.sessionId,focus,root);
      if(event.type==='pointerdown')lastPointer={control,origin:root,sessionId:facts.sessionId,sequence:entry.sequence};
      diagnostics.record(facts.sessionId,'file-click-captured',{capturedFocus:focus,captureSequence:entry.sequence});
    }
    window.addEventListener('pointerdown',capture,true);
    window.addEventListener('click',capture,true);
    return()=>{window.removeEventListener('pointerdown',capture,true);window.removeEventListener('click',capture,true);pending.clear();lastPointer=null;};
  },'better-files: observe local file clicks without changing host navigation');
}
