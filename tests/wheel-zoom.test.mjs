import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {thumbnailWheelPixels,resizeThumbnailsByWheel} from '../src/image-tools.mjs';
import {adaptPreview} from '../scripts/fork-preview.mjs';
const root=new URL('../',import.meta.url),event={ctrlKey:true,deltaY:-10,deltaMode:0,cancelable:true};
test('Ctrl wheel up enlarges and down shrinks smoothly',()=>{
 assert.ok(resizeThumbnailsByWheel(130,thumbnailWheelPixels(event))>130);
 assert.ok(resizeThumbnailsByWheel(130,thumbnailWheelPixels({...event,deltaY:10}))<130);
 const tiny=resizeThumbnailsByWheel(130,-.1);assert.ok(tiny>130&&tiny<131);
});
test('wheel units normalize pixels, lines and pages, with bounded packet magnitude',()=>{
 assert.equal(thumbnailWheelPixels({...event,deltaY:8}),8);
 assert.equal(thumbnailWheelPixels({...event,deltaY:.5,deltaMode:1}),8);
 assert.equal(thumbnailWheelPixels({...event,deltaY:.01,deltaMode:2},800),8);
 assert.equal(thumbnailWheelPixels({...event,deltaY:10000}),40);
 assert.equal(thumbnailWheelPixels({...event,deltaY:-10000}),-40);
});
test('normal scrolling, modifiers, editing and noncancelable/handled events stay untouched',()=>{
 for(const patch of [{ctrlKey:false},{altKey:true},{metaKey:true},{editing:true},{inside:false},{defaultPrevented:true},{cancelable:false},{deltaY:0},{deltaY:NaN},{deltaY:Infinity}])assert.equal(thumbnailWheelPixels({...event,...patch}),0);
});
test('wheel scaling keeps the same thumbnail bounds and handles invalid input',()=>{
 assert.equal(resizeThumbnailsByWheel(400,-40),400);assert.equal(resizeThumbnailsByWheel(80,40),80);
 assert.equal(resizeThumbnailsByWheel(130,NaN),130);assert.equal(resizeThumbnailsByWheel(130,0),130);
 assert.equal(resizeThumbnailsByWheel(130,-999),resizeThumbnailsByWheel(130,-40));
});
test('gallery alone owns a non-passive wheel listener with teardown and no double image zoom',async()=>{
 const source=await readFile(new URL('src/client.jsx',root),'utf8');
 assert.match(source,/if\(!node\|\|selected\|\|folderState!=='gallery'\)return/);
 assert.match(source,/node\.addEventListener\('wheel',wheel,\{passive:false\}\)/);
 assert.match(source,/return\(\)=>node\.removeEventListener\('wheel',wheel\)/);
 assert.match(source,/className="bfv-folder" ref=\{galleryPort\}/);
 assert.match(source,/event\.preventDefault\(\);event\.stopPropagation\(\);\s*setThumbnailSize\(size=>resizeThumbnailsByWheel/);
 assert.doesNotMatch(source,/(window|document)\.addEventListener\(['"]wheel/);
});
test('single image retains the native pointer-anchored Ctrl wheel path and direction guards',async()=>{
 const raw=await readFile(new URL('vendor/dsh/dsh-client-ui-sidebar-documentpreview/package/lib/client.js',root),'utf8');const source=adaptPreview(raw);
 assert.ok(source.includes('if (!event.ctrlKey || props.signal.aborted) return;'));
 assert.ok(source.includes('showZoom(zoomRef.current * Math.exp(-delta * .01), event.clientX, event.clientY)'));
 assert.ok(source.includes('node.addEventListener("wheel", wheel, { passive: false })'));
 assert.ok(source.includes('delta > 0 && zoomRef.current <='));assert.ok(source.includes('delta < 0 && zoomRef.current >='));
 assert.throws(()=>adaptPreview(raw.replace('showZoom(zoomRef.current * Math.exp(-delta * .01), event.clientX, event.clientY);','changedWheel();')),/Upstream anchor changed/);
});
