/**
 * Helper to save a Blob or File with "Save As" file picker if supported by the browser,
 * or fallback to trigger anchor download.
 */
export async function saveFileWithPicker(
  blob: Blob,
  suggestedName: string,
  types: { description: string; accept: Record<string, string[]> }[] = []
): Promise<void> {
  const isInsideIframe = typeof window !== 'undefined' && window.self !== window.top;

  // If not inside an iframe and showSaveFilePicker is supported natively, try file picker
  if (!isInsideIframe && typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const fileExtension = suggestedName.split('.').pop() || '';
      const filterTypes =
        types.length > 0
          ? types
          : [
              {
                description: `${fileExtension.toUpperCase()} Document`,
                accept: {
                  [blob.type || 'application/octet-stream']: [`.${fileExtension}`],
                },
              },
            ];

      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: filterTypes,
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }
      // If any issue occurs, fallback to standard clean anchor download
    }
  }

  // Direct clean download for iframe previews and all standard browsers
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
    URL.revokeObjectURL(url);
  }, 1000);
}
