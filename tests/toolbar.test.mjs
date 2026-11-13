import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import postcss from 'postcss';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('src/client.jsx',root),'utf8');
const style=postcss.parse(await readFile(new URL('src/styles.css',root),'utf8'));
function declarations(selector){const result={};style.walkRules(r=>{if(r.selector===selector)r.walkDecls(d=>result[d.prop]=d.value);});return result;}
test('layout shows a direction icon while retaining the native accessible four-way picker',()=>{
 assert.match(source,/<label className="bfv-layout-picker"[^>]*><Icon name="layout" layout=\{layout\}\/><select/);
 assert.match(source,/className="bfv-layout-select" aria-label=\{labels.layout\}/);
 assert.match(source,/\['left','right','top','bottom'\]\.map/);
 assert.match(source,/onChange=\{e=>setLayout\(e.target.value\)\}/);
 const d=declarations('.bfv-toolbar .bfv-layout-picker select.bfv-layout-select');
 assert.equal(d.opacity,'0');assert.equal(d.width,'100%');assert.notEqual(d.display,'none');assert.notEqual(d.visibility,'hidden');
 assert.equal(declarations('.bfv-layout-picker:focus-within').outline,'2px solid var(--dsw-alias-brand-primary)');
});
test('folder icon has a stable accessible name and pressed means directory pane is visible',()=>{
 assert.match(source,/className="bfv-icon-button bfv-folder-toggle" aria-pressed=\{!focus\}/);
 assert.match(source,/aria-label=\{labels.folder\} onClick=\{\(\)=>setFocus\(v=>!v\)\}><Icon name="folder"/);
 assert.match(source,/title=\{focus\?labels.split:labels.focus\}/);
 assert.match(source,/hidden=\{focus\}/);
});
test('one compact toolbar replaces duplicate path/root/JSON label rows without removing actions',()=>{
 assert.equal((source.match(/className="bfv-toolbar"/g)||[]).length,1);
 assert.doesNotMatch(source,/bfv-preview-toolbar|bfv-tree-root|bfv-format-label|className="bfv-path"/);
 for(const name of ['back','home','refresh','previous','next'])assert.ok(source.includes(`<Icon name="${name}"`),name);
 assert.match(source,/<JsonPreview files=\{files\}/);
 assert.equal(declarations('.bfv-toolbar')['min-height'],'34px');
});
test('toolbar artwork is local currentColor SVG with four distinct layout dividers',async()=>{
 const icons=await readFile(new URL('src/icons.jsx',root),'utf8');
 assert.match(icons,/stroke="currentColor"/);assert.match(icons,/aria-hidden="true" focusable="false"/);
 for(const [name,path]of Object.entries({left:'M7 3v14',right:'M13 3v14',top:'M3 7h14',bottom:'M3 13h14'}))assert.ok(icons.includes(`${name}:'${path}'`));
 assert.doesNotMatch(icons,/@deepseek-ai|#[a-f\d]{6}\b/i);
});
