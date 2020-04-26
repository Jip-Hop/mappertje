const getUrl = (relative) => {
  return new URL(relative, import.meta.url);
};

const LoadCSS = (url, document, errorHandler) => {
  return new Promise((resolve) => {
    const link = document.createElement("link");
    typeof errorHandler === "function" && (link.onerror = errorHandler);
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);

    link.onload = () => {
      resolve();
    };
  });
};

const loadScript = (url, document, errorHandler) => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    typeof errorHandler === "function" && (script.onerror = errorHandler);
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
    await loadScript(
      getUrl("./js/main.js"),
      iframe.contentDocument,
      config.loadErrorHandler
    );

    // Make methods available for iframe
    attachFunctionsToWindow(
      [LoadCSS, loadScript, getUrl, attachFunctionsToWindow],
      iframe.contentWindow
    );

    iframe.contentWindow.setup(config);
  };

  config.targetElement.appendChild(iframe);

  return iframe.contentWindow;
}
