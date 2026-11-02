/** Saves text as a file in the browser's downloads (works on phones too). */
export function downloadText(fileName: string, text: string, type = 'text/plain'): void {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(fileName: string, value: unknown): void {
  downloadText(fileName, JSON.stringify(value, null, 2), 'application/json');
}
