if ("serviceWorker" in navigator && !crossOriginIsolated) {
  navigator.serviceWorker
    .register("./coi-serviceworker.js", { scope: "./" })
    .then(() => {
      if (!navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => location.reload(),
          { once: true },
        );
      } else if (!sessionStorage.getItem("week03-isolation-retry")) {
        sessionStorage.setItem("week03-isolation-retry", "1");
        location.reload();
      }
    })
    .catch((e) => console.warn("隔离未启用", e.message));
}
window.addEventListener("DOMContentLoaded", () => {
  const host = document.getElementById("app");
  if (new URLSearchParams(location.search).has("presenter"))
    host.append(document.createElement("deck-presenter"));
  else {
    const tpl = document.getElementById("deck-template");
    host.append(tpl.content.cloneNode(true));
  }
});
