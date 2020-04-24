const getUrl = (relative) => {
  return new URL(relative, import.meta.url);
};

const loadScript = (url, document) => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.onload = resolve;
    script.src = url;
    document.head.appendChild(script);
  });
};

const attachFunctionsToWindow = (functions, win) => {
  for (let func of functions) {
    win[func.name] = func;
  }
};

export default function (config) {
  const iframe = document.createElement("iframe");
  iframe.style.width = iframe.style.height = "100%";
  iframe.style.opacity = 0;
  iframe.style.transition = "opacity 1s ease";
  iframe.setAttribute("allowFullScreen", "");

  iframe.onload = async () => {
    await loadScript(getUrl("./js/main.js"), iframe.contentWindow.document);

    // Make methods available for iframe
    attachFunctionsToWindow(
      [loadScript, getUrl, attachFunctionsToWindow],
      iframe.contentWindow
    );

    iframe.contentWindow.setup(config);
  };

  config.targetElement.appendChild(iframe);
}
