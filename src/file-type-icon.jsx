import {fileIconKind} from './file-types.mjs';
import {Icon} from './icons.jsx';
// Original page/folder glyphs; no external icon pack or font dependency.
export function FileTypeIcon({path,type='file',expanded=false}){
 const kind=fileIconKind(path,type);
 const marks={
  image:'M6.5 15l2.5-4 2 2 1.5-2 2 4M7.5 9h.01',
  pdf:'M7 15V9h3a1.5 1.5 0 0 1 0 3H7',
  table:'M6.5 9h8v6h-8ZM6.5 11h8M10.5 9v6',
  document:'M6.5 10h8M6.5 12.5h8M6.5 15h5',
  markdown:'M6.5 15V9l2 3 2-3v6M13.5 9v6M12 13.5l1.5 1.5 1.5-1.5',
  data:'M8.5 9H8v2l-1 1 1 1v2h.5M12 9h.5v2l1 1-1 1v2H12',
  code:'M8.5 9.5 6 12l2.5 2.5M12 9.5l2.5 2.5-2.5 2.5',
  text:'M7 10h7M7 12.5h7M7 15h4',
  archive:'M10 8v2M9 10h2v2H9zM10 12v2M9 14h2v2H9z',
  audio:'M10 14V9l4-1v5M10 14a1.5 1 0 1 1-1.5-1H10M14 13a1.5 1 0 1 1-1.5-1H14',
  video:'M8 9.5v6l6-3Z',
  font:'M7 9.5h7M10.5 9.5v6M9 15.5h3',
  binary:'M8 9v6M12.5 9a1 1 0 0 0-1 1v4a1 1 0 0 0 2 0v-4a1 1 0 0 0-1-1Z',
  file:''
 };
 return <span className="bfv-file-icon" data-kind={kind} aria-hidden="true">{kind==='folder'?<Icon name={expanded?'folder-open':'folder'} size={16}/>:<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d="M5 2.5h7l4 4V18H5ZM12 2.5V7h4"/><path d={marks[kind]}/></svg>}</span>;
}
