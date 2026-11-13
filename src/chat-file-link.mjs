const hasClass=(node,name)=>[...(node?.classList||[])].some(value=>new RegExp(`(?:^|_)${name}(?:_|$)`).test(value));
function markdownRoot(node,row){
  for(let current=node?.parentElement;current&&current!==row;current=current.parentElement)if(hasClass(current,'markdown'))return current;
  return null;
}
// Read only identity/order, never labels as paths or private React fields.
export function chatLinkPosition(control,origin){
  const row=control?.closest('[data-chat-node-key]');
  if(!row||row.closest('[data-conversation-session]')!==origin||row.getAttribute('data-chat-flow-kind')!=='assistant-step'||row.getAttribute('data-chat-group-part')==='reasoning')return null;
  const markdown=markdownRoot(control,row);if(!markdown?.parentElement)return null;
  const blocks=[...markdown.parentElement.children].filter(node=>hasClass(node,'markdown'));
  const links=[...markdown.querySelectorAll('button')].filter(node=>hasClass(node,'fileLink')&&markdownRoot(node,row)===markdown);
  const blockIndex=blocks.indexOf(markdown),linkIndex=links.indexOf(control);
  if(blockIndex<0||linkIndex<0||links.length>2048)return null;
  const checks=[];
  for(let index=0;index<links.length&&checks.length<16;index++){const title=links[index].getAttribute('title');if(title)checks.push({index,path:title});}
  return {nodeKey:row.getAttribute('data-chat-node-key'),blockIndex,blockCount:blocks.length,linkIndex,linkCount:links.length,checks};
}
export function resolveChatFileLink(position,node,collect){
  if(!position||node?.key!==position.nodeKey||node.kind!=='assistant-step'||!['settled','interrupted'].includes(node.data?.status))return {error:'No matching settled Chat node'};
  const blocks=node.data.blocks?.filter(block=>block.kind==='text');
  if(!blocks||blocks.length!==position.blockCount||!Number.isInteger(position.blockIndex)||position.blockIndex<0||position.blockIndex>=blocks.length)return {error:'Chat Markdown blocks changed'};
  const block=blocks[position.blockIndex];if(typeof block.text!=='string')return {error:'Missing Markdown source'};
  let links;try{links=collect(block.text);}catch{return {error:'Native Markdown link parsing failed'};}
  if(links.length!==position.linkCount||!Number.isInteger(position.linkIndex)||position.linkIndex<0||position.linkIndex>=links.length)return {error:'Chat link count changed'};
  if(!Array.isArray(position.checks)||position.checks.some(check=>links[check.index]?.path!==check.path))return {error:'Chat link ordering changed'};
  const file=links[position.linkIndex];if(typeof file?.path!=='string'||!file.path)return {error:'Missing native file target'};
  return {file};
}
export function createChatLinkSources(){
  const sessions=new Map();
  return {
    register(sessionId,reader){
      let readers=sessions.get(sessionId);if(!readers)sessions.set(sessionId,readers=new Set());readers.add(reader);
      return()=>{readers.delete(reader);if(!readers.size&&sessions.get(sessionId)===readers)sessions.delete(sessionId);};
    },
    resolve(sessionId,position,collect){
      if(!position||typeof collect!=='function')return {error:'Missing link position/parser'};
      const nodes=[...(sessions.get(sessionId)||[])].map(reader=>reader.nodes?.get(position.nodeKey)).filter(Boolean);
      if(!nodes.length)return {error:'No mounted Chat source for this Session'};
      if(nodes.some(node=>node!==nodes[0]))return {error:'Chat source generations differ'};
      return resolveChatFileLink(position,nodes[0],collect);
    },
    clear(){sessions.clear();}
  };
}
