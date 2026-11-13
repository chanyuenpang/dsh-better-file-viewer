// Expose the pinned local GFM parser and file-link classifier as a data-only
// collector. Do not render components/TeX or touch live DOM to recover a path.
export function exposeNativeLinkCollector(source){
  for(const anchor of ['function parseGfmWithMath(text)', 'function renderSettled(text, labels, fileMentions, pathImages, omitHtml)', 'function MarkdownFileLink({ file, glyph, children })']){
    if(source.split(anchor).length!==2)throw new Error(`Native link collector anchor changed: ${anchor}`);
  }
  return source+`\nexport function collectNativeFileLinks(text){
    const root=parseGfmWithMath(text),targets=createReferenceTargets(),links=[],footnotes=[],seen=new Set();
    collectReferenceTargets(root.children,targets);
    const containers=new Set(['root','paragraph','heading','blockquote','strong','emphasis','delete','list','listItem','table','tableRow','tableCell']);
    function children(node){for(const child of node.children||[])walk(child);}
    function link(url){const file=parseFileLink(url);if(file!==undefined)links.push({...file});}
    function walk(node){
      if(node.type==='link'){link(node.url);children(node);}
      else if(node.type==='linkReference'){const definition=targets.definitions.get(node.identifier.toUpperCase());if(definition)link(definition.url);children(node);}
      else if(node.type==='footnoteReference'){const id=node.identifier.toUpperCase();if(!seen.has(id)){seen.add(id);footnotes.push(id);}}
      else if(containers.has(node.type))children(node);
    }
    walk(root);
    for(const id of footnotes){const definition=targets.footnotes.get(id);if(definition)children(definition);}
    return links;
  }\n`;
}
