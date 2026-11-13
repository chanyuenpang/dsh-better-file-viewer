import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {localImageFilePath,imageSourceKind} from '../src/chat-image-source.mjs';
const base='http://127.0.0.1:36264/';
test('authenticated local image URL preserves the exact decoded native path',()=>{
 const path='G:/Project/A B/%20 literal # & 中文.png';
 assert.equal(localImageFilePath(`${base}api/file?path=${encodeURIComponent(path)}&load=8`,base),path);
 assert.equal(localImageFilePath('/api/file?path=%2Fwork%2Fimage.png',base),'/work/image.png');
});
test('media route matches the deployment prefix and Desktop transport exactly',()=>{
 assert.equal(localImageFilePath('https://host/dsh/api/file?path=%2Fa.png','https://host/dsh/'),'/a.png');
 assert.equal(localImageFilePath('dsh-app://app/api/file?path=G%3A%2Fa.png','dsh-app://app/'),'G:/a.png');
 assert.equal(localImageFilePath('dsh-app://other/api/file?path=%2Fa.png','dsh-app://app/'),null);
});
test('external hosts, other routes, ambiguous or invalid paths cannot become file targets',()=>{
 for(const src of ['https://evil/api/file?path=%2Fa.png',`${base}other/api/file?path=%2Fa.png`,`${base}api/plugin-manager/detail-file?path=%2Fa.png`,`${base}api/file?path=%2Fa&path=%2Fb`,`${base}api/file?path=relative.png`,`${base}api/file?path=%2F%2Fserver%2Fshare`,`${base}api/file?path=%2Fa%00.png`,'http://user:pass@127.0.0.1:36264/api/file?path=%2Fa.png'])assert.equal(localImageFilePath(src,base),null,src);
});
test('blob/data/external images are only classified, never mapped to filesystem paths',()=>{
 for(const [src,kind]of [['blob:http://127.0.0.1:36264/id','blob'],['data:image/png;base64,private','data'],['https://example.com/image.png','other-url']]){
  assert.equal(localImageFilePath(src,base),null);assert.equal(imageSourceKind(src,base),kind);
 }
});
test('pinned inline images have an image button and localized title, not a file-path title',async()=>{
 const raw=await readFile(new URL('../vendor/dsh/dsh-client-ui-primitives/package/lib/index.js',import.meta.url),'utf8');
 const code=raw.slice(raw.indexOf('function LoadedMarkdownImage('),raw.indexOf('function referenceSuffix('));
 assert.match(code,/markdownCss\.imageButton/);assert.match(code,/title: preview.labels.open/);assert.match(code,/setOpen\(true\)/);assert.match(code,/children: img/);
});
test('image diagnostics record metadata only and keep the observer non-interfering',async()=>{
 const code=await readFile(new URL('../src/file-click-bridge.mjs',import.meta.url),'utf8');
 assert.match(code,/'chat-image-click'/);assert.match(code,/localPath:localImageFilePath\(src,document.baseURI\)/);
 assert.doesNotMatch(code,/getAttribute\(['"]alt|getAttribute\(['"]aria-label|outerHTML|innerHTML|textContent|\.preventDefault\(|\.stopPropagation\(/);
});
