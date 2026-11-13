// Original compact line artwork, rendered with the host's currentColor.
export function Icon({name,layout,size=18}){
  const paths={
    home:'M2.5 9 10 2.5 17.5 9M5 7v10h10V7M8 17v-6h4v6',
    refresh:'M16 7a6.5 6.5 0 1 0 .2 5M16 2.5V7h-4.5',
    folder:'M2.5 6V4.5h5L9.5 7h8v9h-15V6Z',
    'folder-open':'M2.5 8V4.5h5L9.5 7h8v2M2.5 9h5l1.5 2H18l-2.5 5h-13Z',
    back:'M9 4 3 10l6 6M3 10h14',
    previous:'M12.5 4 6.5 10l6 6',
    next:'M7.5 4l6 6-6 6'
  };
  const dividers={left:'M7 3v14',right:'M13 3v14',top:'M3 7h14',bottom:'M3 13h14'};
  const panes={left:[3,3,4,14],right:[13,3,4,14],top:[3,3,14,4],bottom:[3,13,14,4]};
  const pane=panes[layout]||panes.left;
  return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name==='layout'?<><rect x="3" y="3" width="14" height="14" rx="1.5"/><rect x={pane[0]} y={pane[1]} width={pane[2]} height={pane[3]} fill="currentColor" fillOpacity=".15" stroke="none"/><path d={dividers[layout]||dividers.left}/></>:<path d={paths[name]}/>}
  </svg>;
}
