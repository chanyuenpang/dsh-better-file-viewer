import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import postcss from 'postcss';
import {IMAGE_ZOOM,THUMBNAIL_SIZE,resizeThumbnails,thumbnailStyle,imageZoomKey} from '../src/image-tools.mjs';
import {createPreviewInstance} from '../src/core.mjs';
import {adaptPreview} from '../scripts/fork-preview.mjs';
const root=new URL('../',import.meta.url);
test('thumbnail keyboard steps are bounded and preserve the original default dimensions',()=>{
 assert.equal(resizeThumbnails(130,1),162);assert.equal(resizeThumbnails(162,-1),130);
 assert.equal(resizeThumbnails(THUMBNAIL_SIZE.maximum,1),400);assert.equal(resizeThumbnails(80,-1),80);
 assert.deepEqual(thumbnailStyle(130),{'--bfv-thumbnail-size':'130px','--bfv-thumbnail-height':'120px'});
 assert.equal(thumbnailStyle(-1)['--bfv-thumbnail-size'],'80px');assert.equal(resizeThumbnails(NaN,0),130);
});
test('Ctrl plus/equal/minus and numpad keys resolve without requiring visible buttons',()=>{
 for(const key of ['+','=','Add'])assert.equal(imageZoomKey({ctrlKey:true,key},true),1);
 for(const key of ['-','_','Subtract'])assert.equal(imageZoomKey({ctrlKey:true,key},true),-1);
 assert.equal(imageZoomKey({ctrlKey:true,key:'Unidentified',code:'NumpadAdd'},true),1);
 assert.equal(imageZoomKey({ctrlKey:true,key:'Unidentified',code:'NumpadSubtract'},true),-1);
});
test('zoom shortcuts do not claim other contexts, editing controls or modified/handled events',()=>{
 const event={ctrlKey:true,key:'+'};assert.equal(imageZoomKey(event,false),0);
 for(const patch of [{inside:false},{editing:true},{defaultPrevented:true},{ctrlKey:false},{altKey:true},{metaKey:true},{key:'x'}])assert.equal(imageZoomKey({...event,...patch},true),0);
});
test('single-image zoom is bound to the independent native zoom instance, with intrinsic-size readiness',async()=>{
 const raw=await readFile(new URL('vendor/dsh/dsh-client-ui-sidebar-documentpreview/package/lib/client.js',root),'utf8');const code=adaptPreview(raw);
 assert.match(code,/bindZoomCommands: occurrence\.actions\.bindCommands/);
 assert.match(code,/props\.intrinsicWidth === void 0\) return/);
 assert.ok(code.includes(`"${IMAGE_ZOOM.in}": () => { if (zoomRef.current <`));
 assert.ok(code.includes(`"${IMAGE_ZOOM.out}": () => { if (zoomRef.current >`));
 assert.ok(code.includes('setZoom(zoomRef.current * 1.25)'));assert.ok(code.includes('setZoom(zoomRef.current / 1.25)'));
 assert.ok(code.includes(`"${IMAGE_ZOOM.value}": () => zoomRef.current`));
 assert.match(code,/DOCUMENT_ZOOM\.maximum/);assert.match(code,/DOCUMENT_ZOOM\.minimum/);
 assert.throws(()=>adaptPreview(raw.replace('function LoadedImage({','function ChangedImage({')),/Upstream anchor changed/);
});
test('zoom commands and cleanup stay independent between preview occurrences',()=>{
 const a=createPreviewInstance('a.png'),b=createPreviewInstance('b.png');let scaleA=1,scaleB=1;
 a.usePreviewInfo().occurrence.actions.bindCommands({[IMAGE_ZOOM.in]:()=>scaleA*=1.25,[IMAGE_ZOOM.value]:()=>scaleA});
 b.usePreviewInfo().occurrence.actions.bindCommands({[IMAGE_ZOOM.in]:()=>scaleB*=1.25,[IMAGE_ZOOM.value]:()=>scaleB});
 a.commands.get(IMAGE_ZOOM.in)();assert.equal(a.commands.get(IMAGE_ZOOM.value)(),1.25);assert.equal(b.commands.get(IMAGE_ZOOM.value)(),1);
 a.dispose();assert.equal(a.commands.size,0);assert.equal(b.commands.has(IMAGE_ZOOM.in),true);b.dispose();
});
test('key handling is local, protects editors/portals, and gallery sizing does not remount thumbnails',async()=>{
 const source=await readFile(new URL('src/client.jsx',root),'utf8');
 assert.match(source,/onKeyDownCapture=\{handleImageZoom\}/);assert.match(source,/tabIndex=\{0\}/);
 assert.match(source,/inside:event\.currentTarget\.contains\(target\)/);assert.match(source,/input,textarea,select,\[contenteditable\]/);
 assert.match(source,/document\.activeElement===document\.body\)rootPort\.current\?\.focus\(\{preventScroll:true\}\);\},\[selected,folder\]\)/);
 assert.match(source,/style=\{thumbnailStyle\(thumbnailSize\)\}/);assert.match(source,/onInstance=\{attachPreview\}/);
 assert.doesNotMatch(source,/key=\{[^}]*thumbnailSize|document\.body\.style\.zoom|addEventListener\(['"]keydown/);
 const css=postcss.parse(await readFile(new URL('src/styles.css',root),'utf8'));const thumbs=[];
 css.walkRules(rule=>{if(rule.selector==='.bfv-thumbnail-image')rule.walkDecls('height',d=>thumbs.push(d.value));});
 assert.deepEqual(thumbs,['var(--bfv-thumbnail-height,120px)']);
});
