// Pinned ConversationContent/DefaultConversationViews DOM contract (DSH 0.2.2-rc.1).
// Direct-child guards apply only to the occurrence that renders our own View root;
// embedded Conversations or a different selected View cannot hide another composer.
export const FILE_VIEW_ROOT = '.bfv-view';
export const FILE_OUTLET = '[data-slot="conversation.view"]';
export const SESSION_OUTLET = '[data-slot="conversation.session"]';
export const FILE_SCROLLER = `[data-conversation-scroll]:has(> ${SESSION_OUTLET} > * > ${FILE_OUTLET} > ${FILE_VIEW_ROOT})`;
export const HOST_LAYOUT_RULES = Object.freeze([
  { selector: FILE_SCROLLER, declarations: { overflow: 'hidden', 'scrollbar-gutter': 'auto', 'overscroll-behavior': 'contain' } },
  { selector: `${FILE_SCROLLER} > ${SESSION_OUTLET} > :has(> ${FILE_OUTLET} > ${FILE_VIEW_ROOT})`, declarations: { flex: '1 1 0', 'min-height': '0', 'min-width': '0', overflow: 'hidden' } },
  { selector: `${FILE_SCROLLER} > [data-composer-seat]`, declarations: { display: 'none' } }
]);
export function hostLayoutCss() {
  return HOST_LAYOUT_RULES.map(({selector,declarations}) => `${selector}{${Object.entries(declarations).map(([k,v])=>`${k}:${v}`).join(';')}}`).join('\n');
}
