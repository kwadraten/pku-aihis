export function downloadBytes(
  bytes: Uint8Array,
  filename: string,
  mime = "application/octet-stream",
) {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
