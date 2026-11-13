const groups={
 image:'png jpg jpeg gif webp bmp ico svg avif tif tiff heic',
 pdf:'pdf',
 table:'csv tsv xls xlsx xlsm ods',
 document:'doc docx odt rtf',
 markdown:'md markdown mdx',
 data:'json jsonc json5 yaml yml toml xml ini conf cfg properties lock',
 code:'js jsx ts tsx mjs cjs py pyw rb rs go java c cpp cc h hpp cs fs php sh bash zsh fish bat cmd ps1 sql html htm css scss sass less vue svelte dart swift kt kts lua r ex exs',
 text:'txt log tex',
 archive:'zip rar 7z tar gz bz2 xz zst tgz',
 audio:'mp3 wav ogg flac m4a aac opus',
 video:'mp4 webm mov mkv avi m4v',
 font:'ttf otf woff woff2',
 binary:'exe dll so bin dmg msi apk wasm'
};
const extensions=new Map(Object.entries(groups).flatMap(([kind,list])=>list.split(' ').map(ext=>[ext,kind])));
export function fileIconKind(path,type='file'){
 if(type==='directory')return 'folder';
 if(type!=='file')return 'file';
 const name=String(path||'').replaceAll('\\','/').split('/').pop().toLowerCase();
 if(/^\.env(?:\.|$)/.test(name)||['.gitignore','.gitattributes','.editorconfig','.npmrc','.prettierrc'].includes(name))return 'data';
 if(['dockerfile','makefile','cmakelists.txt'].includes(name))return 'code';
 if(['license','licence','readme','notice','changelog'].includes(name))return 'text';
 return extensions.get(name.includes('.')?name.slice(name.lastIndexOf('.')+1):'')||'file';
}
