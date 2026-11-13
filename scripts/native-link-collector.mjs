// Expose a pure link collector from the pinned local parser. No host UI imports,
// component rendering, effects, DOM mutation or guessed Markdown regexes.
export function exposeNativeLinkCollector(source){
  for(const anchor of ['function renderSettled(text, labels, fileMentions, pathImages, omitHtml)', 'function MarkdownFileLink({ file, glyph, children })']){
    if(source.split(anchor).length!==2)throw new Error(`Native link collector anchor changed: ${anchor}`);
  }
  return source+`\nexport function collectNativeFileLinks(text){
    const links=[];
    function walk(value){
      if(Array.isArray(value)){for(const child of value)walk(child);return;}
      if(!value||typeof value!=='object'||!value.props)return;
      if(value.type===MarkdownFileLink)links.push({...value.props.file});
      walk(value.props.children);
    }
    walk(renderSettled(text,{code:{},footnotes:''},undefined,undefined,false));
    return links;
  }\n`;
}
