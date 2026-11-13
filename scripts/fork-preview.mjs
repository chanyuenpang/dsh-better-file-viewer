import { IMAGE_ZOOM } from '../src/image-tools.mjs';
// Reproducible, fail-closed adaptation of the integrity-pinned upstream browser artifacts.
// The original side bar registrations are never executed by this fork.
export const PACKAGE = 'dsh-better-file-viewer';
export const UPSTREAM = '@deepseek-ai/dsh-client-ui-sidebar-documentpreview';
export function once(source, before, after) {
  if (source.split(before).length !== 2) throw new Error(`Upstream anchor changed: ${before.slice(0, 100)}`);
  return source.replace(before, after);
}
export function factoryBody(source) {
  const marker = 'factory: (require) => {';
  const start = source.indexOf(marker);
  const end = source.lastIndexOf('\n\t}\n});');
  if (start < 0 || end < start) throw new Error('Unsupported upstream module wrapper');
  return source.slice(start + marker.length, end);
}
export function namespaceFork(source) {
  let result = source.replaceAll(UPSTREAM, PACKAGE)
    .replaceAll('sidebar.right.tab.document', 'betterFiles.document')
    .replaceAll('documentPreviews', 'betterFilesPreviews')
    .replaceAll('DocumentPreviews', 'BetterFilesPreviews')
    .replaceAll('useTabInfo', 'usePreviewInfo')
    .replaceAll('documentTabInfoFactory', 'previewInfoFactory')
    .replace(/\btabInfo:/g, 'previewInfo:')
    .replace(/\bbyTab\b/g, 'byOccurrence');
  for (const name of ['sidebarDocumentPreview', 'documentMarkdown', 'documentHtml', 'sidebarImage', 'sidebarPdf', 'sidebarOffice', 'sidebarExcel', 'sidebarCodePreview', 'documentCode']) {
    result = result.replaceAll(`"${name}"`, `"betterFiles.${name}"`);
  }
  const classes = new Set();
  for (const match of result.matchAll(/var \w+_module_css_default = (\{[\s\S]*?\n\t\t\});/g)) {
    for (const entry of match[1].matchAll(/"[^"]+": "([^"]+)"/g)) for (const cls of entry[1].split(' ')) classes.add(cls);
  }
  // Prefix both CSS rules and their JS mapping, rather than relying on upstream hash uniqueness.
  for (const cls of [...classes].sort((a, b) => b.length - a.length)) {
    const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, 'g'), `bfv-${cls}`);
  }
  return result;
}
export function wireImageZoom(source){
  let result=once(source,
    '\t\t\t\tonPreference: setPreference,\n\t\t\t\tlabels,\n\t\t\t\tsignal: tab.signal,',
    '\t\t\t\tbindZoomCommands: tab.actions.bindCommands,\n\t\t\t\tonPreference: setPreference,\n\t\t\t\tlabels,\n\t\t\t\tsignal: tab.signal,');
  result=once(result,
    'function LoadedImage({ url, name, file, resourceAddress, preference, onPreference, labels, signal, scrollportRef, t, fileDrag, contextMenuProps })',
    'function LoadedImage({ url, name, file, resourceAddress, preference, onPreference, bindZoomCommands, labels, signal, scrollportRef, t, fileDrag, contextMenuProps })');
  result=once(result,'intrinsicWidth: width,\n\t\t\t\thorizontalInset: 24,','intrinsicWidth: width,\n\t\t\t\tbindZoomCommands,\n\t\t\t\thorizontalInset: 24,');
  const wheel='showZoom(zoomRef.current * Math.exp(-delta * .01), event.clientX, event.clientY);';
  result=once(result,wheel,`if (delta > 0 && zoomRef.current <= _deepseek_ai_dsh_client_ui_primitives.DOCUMENT_ZOOM.minimum || delta < 0 && zoomRef.current >= _deepseek_ai_dsh_client_ui_primitives.DOCUMENT_ZOOM.maximum) { scheduleControlsHide(); return; }\n\t\t\t\t\t${wheel}`);
  const fit='\t\t\tconst fitWidth = (0, react.useCallback)(() => {';
  result=once(result,fit,`\t\t\t(0, react.useEffect)(() => {
    if (!props.bindZoomCommands || props.intrinsicWidth === void 0) return;
    return props.bindZoomCommands({
      "${IMAGE_ZOOM.in}": () => { if (zoomRef.current < _deepseek_ai_dsh_client_ui_primitives.DOCUMENT_ZOOM.maximum) setZoom(zoomRef.current * 1.25); },
      "${IMAGE_ZOOM.out}": () => { if (zoomRef.current > _deepseek_ai_dsh_client_ui_primitives.DOCUMENT_ZOOM.minimum) setZoom(zoomRef.current / 1.25); },
      "${IMAGE_ZOOM.value}": () => zoomRef.current
    });
  }, [props.bindZoomCommands, props.intrinsicWidth, setZoom]);\n${fit}`);
  return result;
}
export function adaptPreview(source) {
  let result = wireImageZoom(namespaceFork(source));
  result = once(result, '\t\t\t"sidebarRightTabs",\n', '');
  result = once(result, '\t\t\tctx.effect(() => ctx.sidebarRightTabs.register(textDefinition()), "ui-sidebar-documentpreview: text type");\n', '');
  result = once(result, 'Config(globalThis.__DSH_DOCUMENT_PREVIEW_CONFIG__ ?? {})', 'Config({})');
  result = once(result,
    'ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({\n\t\t\t\tname: "sidebar.right.pane.tab",\n\t\t\t\tkey: TEXTPREVIEW_ID,',
    'ctx.effect(() => ctx.slots.registerFactory({\n\t\t\t\tname: "betterFiles.preview",\n\t\t\t\tscope: "session",');
  result = once(result, '}, TextPreview)), "ui-sidebar-documentpreview: text body");', '}, TextPreview), "better-files: isolated preview factory");');
  const title = /\t\t\tctx\.effect\(\(\) => ctx\.slots\.inject\("sidebar\.right\.pane\.tab\.title",[\s\S]*?\}, TextTitle\)\), "ui-sidebar-documentpreview: text title"\);\n/;
  if (!title.test(result)) throw new Error('Upstream title registration changed');
  result = result.replace(title, '');
  const start = result.indexOf('\t\tfunction PreviewFrame(');
  const end = result.indexOf('\n\t\t//#endregion', start);
  if (start < 0 || end < start) throw new Error('Upstream PreviewFrame changed');
  result = result.slice(0, start) + `\t\tfunction PreviewFrame({ path, pathTrigger, banner, tools, handoff, children, ...data }) {
    const { usePreviewInfo: _info, renderFactorySlot: _factory, ...attributes } = data;
    return react.createElement('div', { className: TextPreview_module_css_default.preview, ...attributes },
      banner,
      react.createElement('div', { className: TextPreview_module_css_default.header },
        react.createElement(_deepseek_ai_dsh_client_ui_primitives.PathLabel, {path, className: TextPreview_module_css_default.path, ...pathTrigger}), tools, handoff),
      react.createElement('div', { className: TextPreview_module_css_default.content }, children));
  }` + result.slice(end);
  result = result.replace('\t\t\t\t\t\tpaneId: panel.id,\n', '');
  // Keep the fork's own instance contract explicit; it never consumes a Sidebar tab record.
  result = result.replace(/\bbyTab\b/g, 'byOccurrence');
  if (/ctx\.sidebarRight|name: "sidebar\.|ctx\.documentPreviews/.test(result)) throw new Error('Forbidden upstream side bar mutation survived adaptation');
  return result.replace(/\btab\b/g, 'occurrence');
}
