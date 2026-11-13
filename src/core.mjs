let previewSequence = 0;
export function createPreviewInstance(address, revision = 0, params = undefined) {
  const controller = new AbortController();
  const id = `better-files-preview-${++previewSequence}`;
  const commands = new Map();
  const occurrence = { id, contentId: address, visible: true, navigation: { revision, params }, signal: controller.signal,
    actions: { bindCommands(value) {
      for (const [key, fn] of Object.entries(value)) commands.set(key, fn);
      return () => { for (const [key, fn] of Object.entries(value)) if (commands.get(key) === fn) commands.delete(key); };
    } }
  };
  const info = { occurrence, panel: { id: `better-files-${id}`, isFloating: false } };
  return { commands, signal: controller.signal, usePreviewInfo: () => info, dispose() { controller.abort(); commands.clear(); } };
}
export const VIEW_ID = 'better-files';
export const PREVIEW_FACTORY = 'betterFiles.preview';
export const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|ico|svg)$/i;
export function basename(p) { return p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p; }
export function joinPath(parent, name) { return parent.replace(/[\\/]+$/, '') + '/' + name; }
export function fileAddress(sessionId, path) {
  const encode = s => encodeURIComponent(s).replace(/%3A/gi, ':');
  const normalized = path.replaceAll('\\', '/').replace(/^(?:\.\/)+/, '');
  return `dsh-resource://file/session/${encode(sessionId)}/${normalized.split('/').map(encode).join('/')}`;
}
export function layoutStyle(layout, ratio) {
  const r = Math.max(15, Math.min(65, Number(ratio) || 27));
  const vertical = layout === 'top' || layout === 'bottom';
  const first = layout === 'right' || layout === 'bottom' ? 100-r : r;
  return { display: 'grid', [vertical ? 'gridTemplateRows' : 'gridTemplateColumns']: `minmax(0, ${first}fr) 6px minmax(0, ${100-first}fr)`, [vertical ? 'gridTemplateColumns' : 'gridTemplateRows']: 'minmax(0, 1fr)' };
}
export function sortedEntries(entries) {
  return [...entries].sort((a, b) => (a.type === 'directory' ? 0 : 1) - (b.type === 'directory' ? 0 : 1) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}
export function errorMessage(error) { return error?.message || error?.code || String(error); }
export function unwrap(result) {
  if (result?.ok === true) return result.value;
  if (result?.ok === false) { const e = new Error(result.error?.message || result.failure?.message || result.error?.code || 'File request failed'); e.code = result.error?.code; throw e; }
  throw new Error('Unexpected file service response');
}
export function decodeJson(data) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(data).replace(/^\uFEFF/, '');
  try { return { text, value: JSON.parse(text) }; } catch (e) { return { text, error: errorMessage(e) }; }
}
export function createLimiter(max = 4) {
  let active = 0;
  const queue = [];
  function drain() {
    while (active < max && queue.length) {
      const item = queue.shift();
      if (item.signal.aborted) { item.reject(item.signal.reason); continue; }
      active++;
      Promise.resolve().then(item.operation).then(item.resolve, item.reject).finally(() => { active--; drain(); });
    }
  }
  return (operation, signal) => new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const item = { operation, signal, resolve, reject };
    const abort = () => { const i = queue.indexOf(item); if (i >= 0) { queue.splice(i, 1); reject(signal.reason); } };
    signal.addEventListener('abort', abort, { once: true });
    item.resolve = value => { signal.removeEventListener('abort', abort); resolve(value); };
    item.reject = error => { signal.removeEventListener('abort', abort); reject(error); };
    queue.push(item); drain();
  });
}
