let ready = false;

// Boots the original Patchouli .NET core as a hidden Blazor WASM iframe and
// exposes its DotNet interop under window.DotNet for Library and later pages.
let bootPromise: Promise<void> | null = null;
export function bootCore(): Promise<void> {
  return bootPromise ||= doBoot().catch(error=>{bootPromise=null;throw error;});
}
async function doBoot(): Promise<void> {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.src = new URL("assets/core/index.html", document.baseURI).href;
  document.body.append(frame);
  const started = Date.now();
  while (!(frame.contentWindow as any)?.coreReady) {
    if (Date.now() - started > 120000)
      throw new Error(
        "Blazor Core 未启动；先运行 pnpm build:core 和 pnpm prepare:core",
      );
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  (window as any).DotNet = frame.contentWindow.DotNet;
  ready = true;
}

export function isCoreReady(): boolean {
  return ready;
}
