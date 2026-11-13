import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import postcss from 'postcss';
import {directoryChain,columnFolderTarget,toggleExpanded,galleryState} from '../src/directory-browser.mjs';
import {filePathKey} from '../src/navigation.mjs';
const cwd='G:\\Project';
test('Miller columns derive one horizontal list per directory level',()=>{
 assert.deepEqual(directoryChain(cwd,'G:/Project/docs/sub'),[cwd,cwd+'/docs',cwd+'/docs/sub']);
 assert.deepEqual(directoryChain(cwd,cwd),[cwd]);
 assert.deepEqual(directoryChain('/','/a/b'),['/','/a','/a/b']);
 assert.deepEqual(directoryChain('G:/','G:/a/b'),['G:/','G:/a','G:/a/b']);
 assert.deepEqual(directoryChain('\\\\server\\share','//server/share/a'),['\\\\server\\share','\\\\server\\share/a']);
});
test('column roots respect Windows casing and workspace boundaries',()=>{
 assert.deepEqual(directoryChain(cwd,'g:/project/DOCS'),[cwd,cwd+'/DOCS']);
 assert.deepEqual(directoryChain(cwd,'G:/Project-other/a'),[cwd]);
 assert.deepEqual(directoryChain('/work','/Work/a'),['/work']);
 assert.deepEqual(directoryChain('/work','/work/../outside'),['/work']);
});
test('clicking an open folder column collapses its branch; a sibling replaces the branch',()=>{
 assert.equal(columnFolderTarget(cwd,cwd,cwd,cwd+'/docs'),cwd+'/docs');
 assert.equal(columnFolderTarget(cwd,cwd+'/docs/sub',cwd,cwd+'/docs'),cwd);
 assert.equal(columnFolderTarget(cwd,cwd+'/docs/sub',cwd+'/docs',cwd+'/docs/sub'),cwd+'/docs');
 assert.equal(columnFolderTarget(cwd,cwd+'/docs/sub',cwd,cwd+'/images'),cwd+'/images');
});
test('tree folder names and arrows share a reversible, non-mutating toggle',()=>{
 const start=new Set([filePathKey(cwd)]),opened=toggleExpanded(start,cwd+'/docs');
 assert.equal(start.has(filePathKey(cwd+'/docs')),false);assert.equal(opened.has(filePathKey(cwd+'/docs')),true);
 assert.deepEqual(toggleExpanded(opened,'g:/project/docs'),start);
 assert.deepEqual(toggleExpanded(opened,cwd+'/docs','open'),opened);
 assert.deepEqual(toggleExpanded(opened,cwd+'/docs','close'),start);
});
test('empty/no-image content stays blank without hiding loading or failures',()=>{
 assert.equal(galleryState({status:'ready',entries:[]},0),'blank');
 assert.equal(galleryState({status:'ready',entries:[{type:'file',name:'x.md'}]},0),'blank');
 assert.equal(galleryState({status:'ready'},3),'gallery');
 assert.equal(galleryState(undefined,0),'loading');
 assert.equal(galleryState({status:'loading'},0),'loading');
 assert.equal(galleryState({status:'failed',error:'denied'},0),'error');
});
test('vertical columns have horizontal overflow and each list owns vertical scrolling',async()=>{
 const css=postcss.parse(await readFile(new URL('../src/styles.css',import.meta.url),'utf8'));
 const values=selector=>{const result={};css.walkRules(r=>{if(r.selector===selector)r.walkDecls(d=>result[d.prop]=d.value);});return result;};
 assert.equal(values('.bfv-columns')['overflow-x'],'auto');assert.equal(values('.bfv-columns')['overflow-y'],'hidden');
 assert.equal(values('.bfv-column-list')['overflow-y'],'auto');assert.equal(values('.bfv-column-list')['min-height'],'0');
 assert.equal(values('.bfv-tree[hidden]').display,'none');assert.equal(values('.bfv-tree.bfv-browser:not([hidden])').display,'flex');
});
test('rendering switches navigation only, not the preview instance, and omits empty labels',async()=>{
 const source=await readFile(new URL('../src/client.jsx',import.meta.url),'utf8');
 assert.match(source,/vertical\?renderColumns\(\)/);assert.match(source,/role="tree">\{renderLevel\(cwd\)\}/);
 assert.match(source,/shouldToggle\?'toggle':'open'/);
 assert.match(source,/key=\{`\$\{selected\}:\$\{reload\}`\}/);
 assert.doesNotMatch(source,/\{labels\.(empty|noImages|select)\}/);
 assert.match(source,/folderState==='gallery'\?<><div className="bfv-gallery-title"/);
 assert.match(source,/row\?\.closest\('\.bfv-column-list'\)/);
 assert.match(source,/port\.scrollLeft\s*\+=/);assert.doesNotMatch(source,/scrollIntoView\(/);
});
