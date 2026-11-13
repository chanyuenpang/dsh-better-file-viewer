import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { VIEW_ID, PREVIEW_FACTORY, IMAGE_RE, basename, joinPath, fileAddress, layoutStyle, errorMessage, unwrap, decodeJson, createLimiter, createPreviewInstance } from './core.mjs';
import { EditorShell } from '../vendor/super-json-editor/src/editor/EditorShell.tsx';
import { consumeFileRequest, sameFilePath, filePathKey } from './navigation.mjs';
import { createDiagnostics, registerDiagnostics, DIAGNOSTIC_BUILD } from './diagnostics.mjs';
import { createPendingFileRequests, observeConversationFileClicks } from './file-click-bridge.mjs';
import { directoryChain, columnFolderTarget, toggleExpanded, galleryState } from './directory-browser.mjs';
import { Icon } from './icons.jsx';
import { FileTypeIcon } from './file-type-icon.jsx';
import { createWorkspaceFiles, createDirectoryLoader } from './directory-loader.mjs';
import { chatLinkPosition, createChatLinkSources } from './chat-file-link.mjs';
import { IMAGE_ZOOM, THUMBNAIL_SIZE, resizeThumbnails, thumbnailStyle, imageZoomKey, thumbnailWheelPixels, resizeThumbnailsByWheel } from './image-tools.mjs';
const limitThumbnail = createLimiter(4);
const copy = {
  zh: { title:'文件', root:'工作目录', layout:'布局', refresh:'刷新', left:'树在左', right:'树在右', top:'目录在上', bottom:'目录在下', tree:'文件树', columns:'层级分栏', folder:'文件夹', images:'图片', loading:'正在读取…', empty:'空文件夹', select:'从文件树选择文件，或选择文件夹浏览图片', noImages:'此文件夹没有可预览的图片', noCwd:'当前会话没有工作目录', unavailable:'文件服务不可用', retry:'重试', truncated:'目录条目达到上限，部分内容未列出', back:'返回文件夹', previous:'上一张', next:'下一张', focus:'隐藏目录', split:'显示目录', json:'JSON · 只读', invalid:'JSON 无法解析，以下为原文', tooLarge:'图片过大，请点击单独浏览', resize:'调整文件树与预览大小', preparing:'预览组件不可用，请重新启用插件', close:'关闭预览', count:'张图片' },
  en: { title:'Files', root:'Working directory', layout:'Layout', refresh:'Refresh', left:'Tree left', right:'Tree right', top:'Columns above', bottom:'Columns below', tree:'File tree', columns:'Folder columns', folder:'Folder', images:'Images', loading:'Reading…', empty:'Empty folder', select:'Select a file, or select a folder to browse images', noImages:'No supported images in this folder', noCwd:'This session has no working directory', unavailable:'File service unavailable', retry:'Retry', truncated:'Directory entry limit reached; some entries are not listed', back:'Back to folder', previous:'Previous image', next:'Next image', focus:'Hide folders', split:'Show folders', json:'JSON · Read only', invalid:'Invalid JSON; showing original text', tooLarge:'Image too large for thumbnail; open individually', resize:'Resize file tree and preview', preparing:'Preview component unavailable; re-enable this plugin', close:'Close preview', count:'images' }
};
function useLabels(locale) {
  const [language, setLanguage] = useState(() => locale.getLocale().active);
  useEffect(() => locale.subscribe(() => setLanguage(locale.getLocale().active)), [locale]);
  return copy[String(language).startsWith('zh') ? 'zh' : 'en'];
}
function useLayoutPreference() {
  const [layout, set] = useState(() => { try { const value=localStorage.getItem('better-files.layout.v1'); return ['left','right','top','bottom'].includes(value) ? value : 'left'; } catch { return 'left'; } });
  const setLayout = value => { set(value); try { localStorage.setItem('better-files.layout.v1',value); } catch {} };
  return [layout,setLayout];
}
function Message({ children, error = false, onRetry, labels }) {
  return <div className={`bfv-message ${error ? 'bfv-error' : ''}`} role={error ? 'alert' : 'status'}><span>{children}</span>{onRetry && <button onClick={onRetry}>{labels.retry}</button>}</div>;
}
function Thumbnail({ path, name, size, sessionId, files, labels, onOpen }) {
  const anchor = useRef(null);
  const [visible,setVisible]=useState(false);
  const [image,setImage]=useState(null);
  const [error,setError]=useState('');
  useEffect(() => {
    if (!globalThis.IntersectionObserver) { setVisible(true); return; }
    const observer=new IntersectionObserver(entries => setVisible(entries[0].isIntersecting), {rootMargin:'120px'});
    if(anchor.current) observer.observe(anchor.current);
    return () => observer.disconnect();
  },[]);
  useEffect(() => {
    if(!visible || size > 8*1024*1024) return;
    const controller=new AbortController(); let url;
    setError('');
    limitThumbnail(async () => {
      const value=unwrap(await files.readBytes(sessionId,path,{},controller.signal));
      if(controller.signal.aborted) return;
      if(value.data.byteLength > 8*1024*1024) throw new Error(labels.tooLarge);
      const ext=path.split('.').pop().toLowerCase();
      const type={svg:'image/svg+xml',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',bmp:'image/bmp',ico:'image/x-icon'}[ext];
      url=URL.createObjectURL(new Blob([value.data],{type})); setImage(url);
    },controller.signal).catch(e=>{if(!controller.signal.aborted)setError(errorMessage(e));});
    return () => { controller.abort(); if(url)URL.revokeObjectURL(url); setImage(null); };
  },[visible,path,sessionId,files,size,labels]);
  return <button ref={anchor} className="bfv-thumbnail" onClick={onOpen} title={error || name}>
    <span className="bfv-thumbnail-image">{image ? <img src={image} alt={name} onError={()=>setError(name)} /> : <span>{size>8*1024*1024 ? labels.tooLarge : error || '▧'}</span>}</span><span className="bfv-thumbnail-name"><FileTypeIcon path={path}/><span className="bfv-entry-name">{name}</span></span>
  </button>;
}
function JsonPreview({ files, sessionId, path, reload, labels }) {
  const [state,setState]=useState({loading:true});
  useEffect(()=>{
    const controller=new AbortController(); setState({loading:true});
    files.readBytes(sessionId,path,{},controller.signal).then(result=>{
      if(controller.signal.aborted)return;
      const value=unwrap(result);
      if(value.data.byteLength>16*1024*1024)throw new Error('JSON exceeds the 16 MiB structured preview limit');
      setState(decodeJson(value.data));
    }).catch(e=>{if(!controller.signal.aborted)setState({failure:errorMessage(e)});});
    return()=>controller.abort();
  },[files,sessionId,path,reload]);
  if(state.loading)return <Message labels={labels}>{labels.loading}</Message>;
  if(state.failure)return <Message error labels={labels}>{state.failure}</Message>;
  if(state.error)return <div className="bfv-json-invalid"><p role="alert">{labels.invalid}: {state.error}</p><pre>{state.text}</pre></div>;
  return <div className="bfv-json"><EditorShell key={`${sessionId}:${path}:${reload}`} value={state.value} rootPageTitle={basename(path)} readOnly enableRawEditor={false} /></div>;
}
function OfficialPreview({ address, renderFactorySlot, labels, reload, navigationParams, onInstance }) {
  const instance=useMemo(()=>createPreviewInstance(address,reload,navigationParams),[address,reload,navigationParams]);
  useEffect(()=>{const detach=onInstance?.(instance);return()=>{detach?.();instance.dispose();};},[instance,onInstance]);
  return <div className="bfv-official" data-better-files-preview="official">{renderFactorySlot(PREVIEW_FACTORY,{usePreviewInfo:instance.usePreviewInfo},{fallback:<Message labels={labels}>{labels.preparing}</Message>})}</div>;
}
function FileWorkspace({ sessionId, cwd, files, renderFactorySlot, locale, viewRequest, completeViewRequest, diagnostics }) {
  const labels=useLabels(locale);
  const [layout,setLayout]=useLayoutPreference();
  const [ratio,setRatio]=useState(27);
  const [focus,setFocus]=useState(false);
  const [thumbnailSize,setThumbnailSize]=useState(THUMBNAIL_SIZE.initial);
  const rootPort=useRef(null),galleryPort=useRef(null),previewInstance=useRef(null);
  const attachPreview=useCallback(instance=>{previewInstance.current=instance;return()=>{if(previewInstance.current===instance)previewInstance.current=null;};},[]);
  const [expanded,setExpanded]=useState(()=>new Set([filePathKey(cwd)]));
  const [levels,setLevels]=useState({});
  const [folder,setFolder]=useState(cwd);
  const [selected,setSelected]=useState(null);
  const [navigationParams,setNavigationParams]=useState(undefined);
  const [navigationError,setNavigationError]=useState('');
  const handledRequest=useRef(null);
  const [reload,setReload]=useState(0);
  const directoryLoader=useMemo(()=>createDirectoryLoader({files,sessionId,onChange:setLevels,onEvent:(event,data)=>diagnostics.record(sessionId,event,data)}),[files,sessionId,diagnostics]);
  const container=useRef(null);
  const treePort=useRef(null),selectedRow=useRef(null),columnsPort=useRef(null);
  const columnPaths=directoryChain(cwd,folder);
  const vertical=layout==='top'||layout==='bottom';
  const reversed=layout==='right'||layout==='bottom';
  const loadDirectory=directoryLoader.load;
  useEffect(()=>{directoryLoader.start();loadDirectory(cwd);return()=>directoryLoader.stop();},[cwd,directoryLoader,loadDirectory]);
  useEffect(()=>{
    if(!viewRequest||viewRequest===handledRequest.current)return;
    diagnostics.record(sessionId,'workspace-request',{request:viewRequest,focusType:typeof viewRequest.focus});
    if(viewRequest.view!==VIEW_ID){diagnostics.record(sessionId,'request-view-mismatch',{expected:VIEW_ID,actual:viewRequest.view});return;}
    try{
      const target=consumeFileRequest(viewRequest,handledRequest.current,sessionId,cwd);
      if(!target)return;
      handledRequest.current=viewRequest;
      diagnostics.record(sessionId,'request-consumed',{target});
      setNavigationError('');setNavigationParams(target.params);
      setExpanded(prev=>new Set([...prev,...target.ancestors.map(filePathKey)]));
      for(const ancestor of target.ancestors)loadDirectory(ancestor);
      setFolder(target.folder);setSelected(target.path);setReload(value=>value+1);
    }catch(error){handledRequest.current=viewRequest;diagnostics.record(sessionId,'request-error',{error:errorMessage(error)});setNavigationError(errorMessage(error));}
    completeViewRequest();
  },[viewRequest,completeViewRequest,sessionId,cwd,loadDirectory,diagnostics]);
  useEffect(()=>{diagnostics.record(sessionId,'preview-state',{selected,folder,address:selected?fileAddress(sessionId,selected):null,previewKind:selected?(/\.json$/i.test(selected)?'sje':'official-fork'):null,reload,navigationError,thumbnailSize});},[diagnostics,sessionId,selected,folder,reload,navigationError,thumbnailSize]);
  useEffect(()=>{if(document.activeElement===document.body)rootPort.current?.focus({preventScroll:true});},[selected,folder]);
  useEffect(()=>{
    const row=selectedRow.current;
    const port=vertical?row?.closest('.bfv-column-list'):treePort.current;
    if(!port||!row||focus)return;
    const box=port.getBoundingClientRect(),item=row.getBoundingClientRect();
    if(item.top<box.top)port.scrollTop+=item.top-box.top;
    else if(item.bottom>box.bottom)port.scrollTop+=item.bottom-box.bottom;
  },[selected,levels,layout,focus]);
  useEffect(()=>{
    if(!vertical||focus)return;
    const port=columnsPort.current,last=port?.lastElementChild;if(!last)return;
    const box=port.getBoundingClientRect(),column=last.getBoundingClientRect();
    if(column.right>box.right)port.scrollLeft+=column.right-box.right;
    else if(column.left<box.left)port.scrollLeft+=column.left-box.left;
  },[folder,layout,focus]);
  function selectFile(path){setNavigationError('');setNavigationParams(undefined);setSelected(path);}
  function selectFolder(path,shouldToggle=true){setNavigationError('');setNavigationParams(undefined);setFolder(path);setSelected(null);setExpanded(prev=>toggleExpanded(prev,path,shouldToggle?'toggle':'open'));loadDirectory(path);}
  function selectColumnFolder(parent,path){
    const nextFolder=columnFolderTarget(cwd,folder,parent,path),closing=sameFilePath(nextFolder,parent);
    setNavigationError('');setNavigationParams(undefined);setSelected(null);setFolder(nextFolder);
    setExpanded(prev=>{const next=toggleExpanded(prev,path,closing?'close':'open');for(const ancestor of directoryChain(cwd,nextFolder))next.add(filePathKey(ancestor));return next;});
    loadDirectory(nextFolder);
  }
  function toggle(path){const key=filePathKey(path);if(!expanded.has(key))loadDirectory(path);setExpanded(prev=>toggleExpanded(prev,path));}
  function refresh(){for(const p of new Map([cwd,folder,...expanded].map(path=>[filePathKey(path),path])).values())loadDirectory(p,true);setReload(n=>n+1);}
  const folderLevel=levels[filePathKey(folder)];
  const images=(folderLevel?.entries||[]).filter(e=>e.type==='file'&&IMAGE_RE.test(e.name));
  const folderState=galleryState(folderLevel,images.length);
  const imageIndex=images.findIndex(e=>sameFilePath(joinPath(folder,e.name),selected));
  const imageContext=selected?IMAGE_RE.test(selected):folderState==='gallery';
  useEffect(()=>{
    const node=galleryPort.current;
    if(!node||selected||folderState!=='gallery')return;
    const wheel=event=>{
      const target=event.target;
      const editing=!!target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
      const pixels=thumbnailWheelPixels({ctrlKey:event.ctrlKey,altKey:event.altKey,metaKey:event.metaKey,deltaY:event.deltaY,deltaMode:event.deltaMode,cancelable:event.cancelable,defaultPrevented:event.defaultPrevented,editing,inside:node.contains(target)},node.clientHeight);
      if(!pixels)return;
      event.preventDefault();event.stopPropagation();
      setThumbnailSize(size=>resizeThumbnailsByWheel(size,pixels));
      diagnostics.record(sessionId,'image-zoom-wheel',{mode:'thumbnails',pixels});
    };
    node.addEventListener('wheel',wheel,{passive:false});
    return()=>node.removeEventListener('wheel',wheel);
  },[selected,folderState,folder,diagnostics,sessionId]);
  function handleImageZoom(event){
    const target=event.target;
    const editing=!!target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
    const direction=imageZoomKey({key:event.key,code:event.code,ctrlKey:event.ctrlKey,altKey:event.altKey,metaKey:event.metaKey,defaultPrevented:event.defaultPrevented,editing,inside:event.currentTarget.contains(target)},imageContext);
    if(!direction)return;
    event.preventDefault();event.stopPropagation();
    if(selected){
      const command=previewInstance.current?.commands.get(direction>0?IMAGE_ZOOM.in:IMAGE_ZOOM.out);
      command?.();
      diagnostics.record(sessionId,'image-zoom-shortcut',{mode:'image',direction,ready:!!command,scale:previewInstance.current?.commands.get(IMAGE_ZOOM.value)?.()});
    }else{
      setThumbnailSize(size=>resizeThumbnails(size,direction));
      diagnostics.record(sessionId,'image-zoom-shortcut',{mode:'thumbnails',direction});
    }
  }
  function focusImageArea(event){
    if(imageContext&&event.button===0&&!event.target?.closest?.('button,a,input,textarea,select,[contenteditable],[role="textbox"]'))rootPort.current?.focus({preventScroll:true});
  }
  function stepImage(delta){if(!images.length)return;const index=(Math.max(0,imageIndex)+delta+images.length)%images.length;selectFile(joinPath(folder,images[index].name));}
  function renderLevel(path,depth=0){
    const level=levels[filePathKey(path)];
    if(!level||level.status==='loading'&&!level.entries)return <div className="bfv-tree-note">{labels.loading}</div>;
    if(level.status==='failed')return <div className="bfv-tree-note bfv-error"><span>{level.error}</span><button onClick={()=>loadDirectory(path,true)}>{labels.retry}</button></div>;
    return <>{(level.entries||[]).map(entry=>{
      const full=joinPath(path,entry.name),isDir=entry.type==='directory',open=expanded.has(filePathKey(full));
      return <React.Fragment key={full}><div ref={sameFilePath(selected,full)?selectedRow:undefined} className={`bfv-tree-row ${sameFilePath(selected,full) || !selected&&sameFilePath(folder,full) ? 'is-current':''}`} style={{paddingLeft:8+depth*14}} role="treeitem" aria-expanded={isDir?open:undefined} aria-selected={sameFilePath(selected,full)}>
        {isDir?<button className="bfv-twisty" aria-label={`${open?'▾':'▸'} ${entry.name}`} onClick={()=>toggle(full)}>{open?'▾':'▸'}</button>:<span className="bfv-twisty" aria-hidden="true"/>}
        <button className="bfv-tree-name" disabled={entry.type==='other'} aria-expanded={isDir?open:undefined} title={full} onClick={()=>{if(isDir)selectFolder(full);else{setFolder(path);selectFile(full);}}}><FileTypeIcon path={full} type={entry.type} expanded={open}/><span className="bfv-entry-name">{entry.name}</span></button>
      </div>{isDir&&open&&<div role="group">{renderLevel(full,depth+1)}</div>}</React.Fragment>;
    })}{level.truncated&&<div className="bfv-tree-note">{labels.truncated}</div>}</>;
  }
  function renderColumns(){
    return <div className="bfv-columns" ref={columnsPort}>
      {columnPaths.map((path,index)=>{
        const level=levels[filePathKey(path)];
        return <section className="bfv-column" key={filePathKey(path)} aria-label={path}>
          <button className="bfv-column-heading" title={index?`${labels.back}: ${columnPaths[index-1]}`:cwd} onClick={()=>index?selectColumnFolder(columnPaths[index-1],path):selectFolder(cwd,false)}><FileTypeIcon path={path} type="directory" expanded/><span className="bfv-entry-name">{basename(path)}</span></button>
          <div className="bfv-column-list" role="list">
            {!level||level.status==='loading'&&!level.entries?<div className="bfv-tree-note">{labels.loading}</div>:level.status==='failed'?<div className="bfv-tree-note bfv-error"><span>{level.error}</span><button onClick={()=>loadDirectory(path,true)}>{labels.retry}</button></div>:<>
              {(level.entries||[]).map(entry=>{
                const full=joinPath(path,entry.name),isDir=entry.type==='directory';
                const open=isDir&&columnPaths.some(part=>sameFilePath(part,full));
                const current=sameFilePath(selected,full)||open;
                return <div className="bfv-column-row" role="listitem" key={entry.name}><button ref={sameFilePath(selected,full)?selectedRow:undefined} className={`bfv-column-entry ${current?'is-current':''}`} title={full} disabled={entry.type==='other'} aria-expanded={isDir?open:undefined} aria-current={current?'true':undefined} onClick={()=>{if(isDir)selectColumnFolder(path,full);else{setFolder(path);selectFile(full);}}}><FileTypeIcon path={full} type={entry.type} expanded={open}/><span className="bfv-entry-name">{entry.name}</span>{isDir&&<span className="bfv-column-disclosure" aria-hidden="true">{open?'‹':'›'}</span>}</button></div>;
              })}
              {level.truncated&&<div className="bfv-tree-note">{labels.truncated}</div>}
            </>}
          </div>
        </section>;
      })}
    </div>;
  }
  function beginResize(e){
    if(e.button!==0)return;e.preventDefault();const handle=e.currentTarget;handle.setPointerCapture(e.pointerId);
    const rect=container.current.getBoundingClientRect();
    const move=event=>{const position=vertical?(event.clientY-rect.top)/rect.height:(event.clientX-rect.left)/rect.width;setRatio(Math.max(15,Math.min(65,(reversed?1-position:position)*100)));};
    const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);};
    handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
  }
  const grid=layoutStyle(layout,ratio);
  const treeOrder=reversed?3:1,previewOrder=reversed?1:3;
  return <section ref={rootPort} className="bfv-root" tabIndex={0} onKeyDownCapture={handleImageZoom} onPointerDownCapture={focusImageArea} aria-label={labels.title} data-better-files-view="true">
    <header className="bfv-toolbar" title={selected||folder}>
      {selected&&<button className="bfv-icon-button" onClick={()=>setSelected(null)} title={labels.back} aria-label={labels.back}><Icon name="back"/></button>}
      <button className="bfv-icon-button" onClick={()=>selectFolder(cwd,false)} title={`${labels.root}: ${cwd}`} aria-label={labels.root}><Icon name="home"/></button>
      <button className="bfv-icon-button" onClick={refresh} title={labels.refresh} aria-label={labels.refresh}><Icon name="refresh"/></button>
      <span className="bfv-spacer"/>
      {selected&&IMAGE_RE.test(selected)&&imageIndex>=0&&<><button className="bfv-icon-button" onClick={()=>stepImage(-1)} title={labels.previous} aria-label={labels.previous}><Icon name="previous"/></button><span className="bfv-image-count">{imageIndex+1}/{images.length}</span><button className="bfv-icon-button" onClick={()=>stepImage(1)} title={labels.next} aria-label={labels.next}><Icon name="next"/></button></>}
      <label className="bfv-layout-picker" title={`${labels.layout}: ${labels[layout]}`}><Icon name="layout" layout={layout}/><select className="bfv-layout-select" aria-label={labels.layout} title={`${labels.layout}: ${labels[layout]}`} value={layout} onChange={e=>setLayout(e.target.value)}>{['left','right','top','bottom'].map(x=><option key={x} value={x}>{labels[x]}</option>)}</select></label>
      <button className="bfv-icon-button bfv-folder-toggle" aria-pressed={!focus} title={focus?labels.split:labels.focus} aria-label={labels.folder} onClick={()=>setFocus(v=>!v)}><Icon name="folder"/></button>
    </header>
    {navigationError&&<div className="bfv-navigation-error" role="alert">{navigationError}</div>}
    <div className={`bfv-panes ${vertical?'is-vertical':''} ${focus?'is-focused':''}`} ref={container} style={focus?{display:'grid',gridTemplateColumns:'minmax(0,1fr)',gridTemplateRows:'minmax(0,1fr)'}:grid}>
      <aside ref={treePort} className={`bfv-tree ${vertical?'bfv-browser':''}`} hidden={focus} style={{order:treeOrder}} aria-label={vertical?labels.columns:labels.tree}>
        {vertical?renderColumns():<div role="tree">{renderLevel(cwd)}</div>}
      </aside>
      {!focus&&<div className="bfv-separator" style={{order:2}} role="separator" tabIndex={0} aria-label={labels.resize} aria-orientation={vertical?'horizontal':'vertical'} aria-valuemin={15} aria-valuemax={65} aria-valuenow={Math.round(ratio)} onPointerDown={beginResize} onKeyDown={e=>{if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();setRatio(r=>e.key==='Home'?15:e.key==='End'?65:Math.max(15,Math.min(65,r+(['ArrowLeft','ArrowUp'].includes(e.key)?-3:3)*(reversed?-1:1))));}}} />}
      <main className="bfv-preview" style={{order:focus?1:previewOrder}}>
        {!selected?<div className="bfv-folder" ref={galleryPort}>
          {folderState==='error'?<Message error labels={labels} onRetry={()=>loadDirectory(folder,true)}>{folderLevel.error}</Message>:folderState==='loading'?<Message labels={labels}>{labels.loading}</Message>:folderState==='gallery'?<><div className="bfv-gallery-title">{labels.images} · {images.length} {labels.count}</div><div className="bfv-gallery" style={thumbnailStyle(thumbnailSize)}>{images.map(e=><Thumbnail key={joinPath(folder,e.name)} path={joinPath(folder,e.name)} name={e.name} size={e.size} sessionId={sessionId} files={files} labels={labels} onOpen={()=>selectFile(joinPath(folder,e.name))}/>)}</div></>:null}
        </div>
        :/\.json$/i.test(selected)?<JsonPreview files={files} sessionId={sessionId} path={selected} reload={reload} labels={labels}/>
        :<OfficialPreview key={`${selected}:${reload}`} address={fileAddress(sessionId,selected)} renderFactorySlot={renderFactorySlot} labels={labels} reload={reload} navigationParams={navigationParams} onInstance={attachPreview}/>}
      </main>
    </div>
  </section>;
}
export function createApplication(forkApply, styleText, collectNativeFileLinks) {
  return { inject:['slots','locale','remote','remote.workspaceFiles','resources','configForms','fileDrag'], apply(ctx){
    const diagnostics=createDiagnostics({workspaceFilesHandleStable:ctx.remote.workspaceFiles===ctx.remote.workspaceFiles,imageProbe:2,get focused(){return document.hasFocus();},get visibility(){return document.visibilityState;}}),pendingFiles=createPendingFileRequests();
    registerDiagnostics(ctx,diagnostics);
    const chatSources=createChatLinkSources();
    ctx.effect(()=>()=>chatSources.clear());
    function BoundChatLinkSource(props){
      const nodes=props.useChat(snapshot=>snapshot.nodes),reader=useRef({nodes});
      useLayoutEffect(()=>{reader.current.nodes=nodes;},[nodes]);
      useLayoutEffect(()=>chatSources.register(props.sessionId,reader.current),[props.sessionId]);
      return null;
    }
    function ChatLinkSource(props){return typeof props.useChat==='function'?<BoundChatLinkSource {...props}/>:null;}
    ctx.slots.inject('conversation.session.header.utilities',()=>ctx.slots.register({name:'conversation.session.header.utilities',id:'better-files-chat-source',order:1000},ChatLinkSource));
    observeConversationFileClicks(ctx,pendingFiles,diagnostics,(facts,control,origin)=>{
      const position=chatLinkPosition(control,origin),result=chatSources.resolve(facts.sessionId,position,collectNativeFileLinks);
      diagnostics.record(facts.sessionId,result.file?'image-link-resolved':'image-link-unresolved',{imageLinkPosition:position,imageLinkTarget:result.file||null,imageLinkError:result.error||null});
      return result.file;
    });
    forkApply(ctx);
    ctx.effect(()=>{const style=document.createElement('style');style.dataset.plugin='dsh-better-file-viewer';style.textContent=styleText;document.head.append(style);return()=>style.remove();});
    ctx.effect(()=>ctx.locale.register('betterFiles', {zh:{title:'文件'},en:{title:'Files'}}));
    const t=ctx.locale.bind('betterFiles');
    function FilesView(props){
      const cwd=props.useSessions(s=>s.byId[props.sessionId]?.cwd);
      const files=useMemo(()=>createWorkspaceFiles(()=>ctx.remote.workspaceFiles),[]);
      const labels=useLabels(ctx.locale),root=useRef(null);
      const [captured,setCaptured]=useState(null);
      const request=props.viewRequest||(captured?.sessionId===props.sessionId?captured.request:null);
      const completeRequest=useCallback(()=>{if(props.viewRequest)props.completeViewRequest();else setCaptured(null);},[props.viewRequest,props.completeViewRequest]);
      useEffect(()=>{
        const origin=root.current?.closest('[data-conversation-session]');
        if(!origin)return;
        const entry=pendingFiles.peek(props.sessionId,origin);
        if(props.viewRequest){setCaptured(null);if(entry)pendingFiles.acknowledge(props.sessionId,entry.sequence);return;}
        if(!entry)return;
        pendingFiles.acknowledge(props.sessionId,entry.sequence);
        diagnostics.record(props.sessionId,'file-click-delivered',{deliveredFocus:entry.request.focus,captureSequence:entry.sequence});
        setCaptured({sessionId:props.sessionId,request:entry.request});
      },[props.sessionId,props.viewRequest,cwd]);
      useEffect(()=>{diagnostics.record(props.sessionId,'view-mounted',{mounted:true,cwd});return()=>diagnostics.record(props.sessionId,'view-unmounted',{mounted:false});},[props.sessionId,cwd]);
      useEffect(()=>{diagnostics.record(props.sessionId,'view-props',{request,nativeRequest:props.viewRequest,focusType:typeof request?.focus,cwd,canCompleteRequest:typeof completeRequest==='function'});},[props.sessionId,request,props.viewRequest,completeRequest,cwd]);
      return <div ref={root} className="bfv-view" data-better-files-build={DIAGNOSTIC_BUILD} data-better-files-session={props.sessionId}>
        {cwd ? <FileWorkspace key={`${props.sessionId}:${cwd}`} sessionId={props.sessionId} cwd={cwd} files={files} renderFactorySlot={props.renderFactorySlot} locale={ctx.locale} viewRequest={request} completeViewRequest={completeRequest} diagnostics={diagnostics}/> : <Message labels={labels}>{labels.noCwd}</Message>}
      </div>;
    }
    ctx.slots.inject('conversation.view',()=>ctx.slots.register({name:'conversation.view',id:VIEW_ID,order:40,label:()=>t('title')},FilesView));
  }};
}
