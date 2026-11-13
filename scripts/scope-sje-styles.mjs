import postcss from 'postcss';
// Preserve SJE declarations verbatim. Only relocate page roots and keyframe names
// so the original stylesheet cannot style the surrounding Harness application.
export function scopeSjeStyles(source) {
  const css=postcss.parse(source);
  const frames=new Map();
  css.walkAtRules(/keyframes$/i,rule=>{const original=rule.params;rule.params='bfv-'+original;frames.set(original,rule.params);});
  css.walkDecls(/^animation/,d=>{for(const [before,after] of [...frames].sort(([a],[b])=>b.length-a.length))d.value=d.value.replaceAll(before,after);});
  css.walkRules(rule=>{
    if(rule.parent.type==='atrule'&&/keyframes/i.test(rule.parent.name))return;
    rule.selectors=[...new Set(rule.selectors.map(selector=>/^(?::root|html|body|#root)$/.test(selector.trim())?'.bfv-json':`.bfv-json ${selector}`))];
  });
  return css.toString();
}
