/**
 * Copy text to the clipboard. Uses Clipboard API first, then a textarea + execCommand
 * fallback (Safari/iOS often block async clipboard after await fetch; fallback usually works).
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || !text) return false;

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* try ClipboardItem (some WebKit builds handle multiline better) */
    }
  }

  if (window.isSecureContext && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }) }),
      ]);
      return true;
    } catch {
      /* try fallback */
    }
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '0';
    ta.style.top = '0';
    ta.style.width = '1px';
    ta.style.height = '1px';
    ta.style.padding = '0';
    ta.style.border = 'none';
    ta.style.outline = 'none';
    ta.style.boxShadow = 'none';
    ta.style.background = 'transparent';
    ta.style.opacity = '0';
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    ta.focus({ preventScroll: true });
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
