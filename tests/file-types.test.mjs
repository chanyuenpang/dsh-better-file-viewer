import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileIconKind} from '../src/file-types.mjs';
const root=new URL('../',import.meta.url);
test('directory metadata always wins over a filename extension',()=>{
 assert.equal(fileIconKind('photo.png','directory'),'folder');assert.equal(fileIconKind('','directory'),'folder');
 assert.equal(fileIconKind('photo.png','other'),'file');
});
test('common file extensions get distinct type glyphs, case-insensitively',()=>{
 for(const [name,kind]of Object.entries({'photo.PNG':'image','plan.PDF':'pdf','data.xlsx':'table','file.docx':'document','README.md':'markdown','package.json':'data','src/client.TSX':'code','debug.log':'text','archive.tar.gz':'archive','sound.flac':'audio','movie.mp4':'video','font.woff2':'font','tool.exe':'binary'}))assert.equal(fileIconKind(name),kind,name);
 assert.equal(fileIconKind('G:\\Source\\core.PY'),'code');
});
test('special config files and extensionless names have sensible fallbacks',()=>{
 assert.equal(fileIconKind('.env.local'),'data');assert.equal(fileIconKind('.gitignore'),'data');assert.equal(fileIconKind('Dockerfile'),'code');
 assert.equal(fileIconKind('LICENSE'),'text');assert.equal(fileIconKind('unknown.xyz'),'file');assert.equal(fileIconKind('README'),'text');assert.equal(fileIconKind(''),'file');
});
test('both navigation modes and image captions use actual file/folder glyphs',async()=>{
 const source=await readFile(new URL('src/client.jsx',root),'utf8');
 assert.equal((source.match(/<FileTypeIcon path=\{full\} type=\{entry.type\} expanded=\{open\}\/>/g)||[]).length,2);
 assert.match(source,/<FileTypeIcon path=\{path\} type="directory" expanded\/>/);
 assert.match(source,/className="bfv-thumbnail-name"><FileTypeIcon path=\{path\}/);
 assert.match(source,/className="bfv-twisty" aria-hidden="true"\/>/);
});
test('folder glyphs expose open/closed state and icons use no external module or font',async()=>{
 const source=await readFile(new URL('src/file-type-icon.jsx',root),'utf8');
 assert.match(source,/expanded\?'folder-open':'folder'/);assert.match(source,/data-kind=\{kind\} aria-hidden="true"/);
 assert.match(source,/stroke="currentColor"/);assert.doesNotMatch(source,/@deepseek-ai|https?:|<text|font-family/);
});
