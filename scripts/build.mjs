import { build as esbuild } from 'esbuild';
import postcss from 'postcss';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adaptPreview, namespaceFork, factoryBody, PACKAGE } from './fork-preview.mjs';
import { hostLayoutCss } from '../src/host-layout.mjs';
import { scopeSjeStyles } from './scope-sje-styles.mjs';
import { exposeNativeLinkCollector } from './native-link-collector.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const bundledInputs=new Set();
async function build(options){const result=await esbuild({...options,metafile:true});for(const input of Object.keys(result.metafile.inputs))bundledInputs.add(input);return result;}
const upstream=path.join(root,'vendor/dsh/dsh-client-ui-sidebar-documentpreview/package/lib');
const primitives=path.join(root,'vendor/dsh/dsh-client-ui-primitives/package/lib/index.js');
const store=path.join(root,'vendor/dsh/dsh-client-store/package/lib/index.js');
await mkdir(path.join(root,'.build'),{recursive:true});
const options={absWorkingDir:root,bundle:true,format:'cjs',platform:'browser',target:['chrome120'],write:false,minify:false,legalComments:'inline',external:['react','react-dom','react/jsx-runtime','react/jsx-dev-runtime'],loader:{'.module.css':'local-css','.css':'css','.woff2':'dataurl','.woff':'dataurl','.ttf':'dataurl'},alias:{'@deepseek-ai/dsh-client-store':store},logLevel:'warning'};
function outputOf(result,extension){return result.outputFiles.find(f=>f.path.endsWith(extension))?.text||'';}
function styleCode(css,key){return css?`{const s=document.createElement('style');s.dataset.plugin=${JSON.stringify(PACKAGE)};s.dataset.bfvStyle=${JSON.stringify(key)};s.textContent=${JSON.stringify(css)};document.head.appendChild(s);}`:'';}
function cjs(code){return `(function(){var module={exports:{}};var exports=module.exports;${code}\nreturn module.exports;})()`;}
async function primitiveBundle(source,key){
  const names=[...new Set([...source.matchAll(/_deepseek_ai_dsh_client_ui_primitives\.(\w+)/g)].map(m=>m[1]))];
  if(key==='main')names.push('collectNativeFileLinks');
  if(!names.length)return {code:'{}',css:''};
  const plugins=key==='main'?[{name:'native-link-collector',setup(build){build.onLoad({filter:/index\.js$/},async args=>{if(path.resolve(args.path)!==path.resolve(primitives))return;return {contents:exposeNativeLinkCollector(await readFile(args.path,'utf8')),loader:'js',resolveDir:path.dirname(args.path)};});}}]:[];
  const result=await build({...options,plugins,stdin:{contents:`export {${names.join(',')}} from ${JSON.stringify(primitives.replaceAll('\\','/'))};`,resolveDir:root,sourcefile:`fork-primitives-${key}.js`},outfile:path.join(root,'.build',`${key}-primitives.js`)});
  // CSS modules get unique generated names; global KaTeX rules remain limited to this viewer.
  const parsed=postcss.parse(outputOf(result,'.css'));
  parsed.walkRules(rule=>{if(rule.parent.type==='atrule'&&/keyframes/i.test(rule.parent.name))return;if(rule.selector.includes('.katex'))rule.selectors=rule.selectors.map(s=>`.bfv-official ${s}`);});
  return {code:cjs(outputOf(result,'.js')),css:parsed.toString()};
}
function localRequirements(source){return source.replace('require("@deepseek-ai/dsh-client-ui-primitives")','forkPrimitives').replace('require("@deepseek-ai/dsh-client-store")','forkStore').replace(/\n\/\/# sourceMappingURL=.*$/gm,'');}
const storeResult=await build({...options,entryPoints:[store],outfile:path.join(root,'.build/store.js')});
const storeCode=cjs(outputOf(storeResult,'.js'));
const raw=await readFile(path.join(upstream,'client.js'),'utf8');
const adapted=adaptPreview(raw);
await writeFile(path.join(root,'.build/preview-adapted.js'),adapted);
const primitive=await primitiveBundle(adapted,'main');
const editorPlugin={name:'scoped-editor-portals',setup(build){build.onLoad({filter:/vendor[\\/]super-json-editor[\\/]src[\\/].*\.tsx?$/},async args=>({contents:(await readFile(args.path,'utf8')).replaceAll('document.body',"document.querySelector('.bfv-json')"),loader:args.path.endsWith('.tsx')?'tsx':'ts',resolveDir:path.dirname(args.path)}));}};
const application=await build({...options,jsx:'automatic',entryPoints:[path.join(root,'src/client.jsx')],outfile:path.join(root,'.build/application.js'),plugins:[editorPlugin]});
const upstreamCss=scopeSjeStyles(await readFile(path.join(root,'vendor/super-json-editor/upstream-styles.css'),'utf8'));
const customCss=await readFile(path.join(root,'src/styles.css'),'utf8')+'\n'+upstreamCss+'\n'+await readFile(path.join(root,'src/json-base.css'),'utf8')+'\n'+hostLayoutCss();
await writeFile(path.join(root,'.build/viewer.css'),customCss);
const previewBody=localRequirements(factoryBody(adapted));
const rootScript=`/* dsh-better-file-viewer: independently namespaced fork; see THIRD_PARTY_NOTICES.md */\nwindow.__ModuleLoader__.load({id:${JSON.stringify(PACKAGE)},factory(require){\nfunction initializationFailure(ctx,error){ console.error('[better-files] initialization failed',error); const React=require('react');ctx.slots.inject('conversation.view',()=>ctx.slots.register({name:'conversation.view',id:'better-files-error:'+String(error.message),order:40,label:'文件 / Files ⚠'},()=>React.createElement('pre',{role:'alert',style:{padding:16,whiteSpace:'pre-wrap'}},String(error.stack||error)))); }\ntry {\n${styleCode(primitive.css,'primitives')}\nconst forkPrimitives=${primitive.code};\nconst forkStore=${storeCode};\nconst preview=(function(require){${previewBody}\n})(require);\nconst application=${cjs(outputOf(application,'.js'))};\nconst plugin=application.createApplication(preview.apply,${JSON.stringify(customCss)},forkPrimitives.collectNativeFileLinks);\nconst apply=plugin.apply;plugin.apply=(ctx)=>{try{apply(ctx);}catch(error){initializationFailure(ctx,error);}};return plugin;\n} catch(error){return {inject:['slots'],apply(ctx){initializationFailure(ctx,error);}};}\n}});\n`;
await writeFile(path.join(root,'client.js'),rootScript);
for(const name of ['client.frontmatter-fields.js','client.pdf.js','client.excel.js']){
  let source=namespaceFork(await readFile(path.join(upstream,name),'utf8')).replace(/\btab\b/g,'occurrence');
  const primitive=await primitiveBundle(source,name.replaceAll('.','-'));
  source=localRequirements(source);
  source=source.replace('factory: (require) => {',()=>`factory: (require) => {\n${styleCode(primitive.css,name)}\nconst forkPrimitives=${primitive.code};`);
  await writeFile(path.join(root,name),source);
}
// Fail the build if a browser bundle would import a private Harness UI module.
for(const name of ['client.js','client.frontmatter-fields.js','client.pdf.js','client.excel.js']){
  const source=await readFile(path.join(root,name),'utf8');
  if(/require\(["']@deepseek-ai\/dsh-client-/.test(source))throw new Error(`Private browser dependency in ${name}`);
  if(/ctx\.sidebarRight(?:Tabs)?\./.test(source))throw new Error(`Side bar mutation in ${name}`);
}
const packages=new Map();
for(const input of bundledInputs){
  if(!input.includes('node_modules'))continue;
  let dir=path.dirname(path.resolve(root,input));
  while(dir!==root&&dir!==path.dirname(dir)){
    try{const manifest=JSON.parse(await readFile(path.join(dir,'package.json'),'utf8'));packages.set(`${manifest.name}@${manifest.version}`,{dir,manifest});break;}catch{}
    dir=path.dirname(dir);
  }
}
const notices=[];
for(const [name,{dir,manifest}]of [...packages].sort(([a],[b])=>a.localeCompare(b))){
  notices.push(`=== ${name} (${manifest.license||'see upstream'}) ===`);
  for(const file of await readdir(dir))if(/^(licen[sc]e|copying|notice)([.-]|$)/i.test(file)){
    try{notices.push(await readFile(path.join(dir,file),'utf8'));}catch{}
  }
}
await writeFile(path.join(root,'THIRD_PARTY_LICENSES.txt'),notices.join('\n\n')+'\n');
console.log(`Built isolated viewer + PDF/Excel/frontmatter chunks; ${packages.size} dependency license records; no private Harness UI imports or sidebar writes`);
