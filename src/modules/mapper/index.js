import fixPerspective from "./js/css3-perspective.js";
import setupMain from "./js/main.js";
import setupSource from "./js/source.js";

const getUrl = (relative) => {
  return new URL(relative, import.meta.url);
};

const loadCSS = (url, document, errorHandler) => {
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

export default function (config) {
  const iframe = document.createElement("iframe");
  iframe.style.width = iframe.style.height = "100%";
  iframe.style.opacity = 0;
  iframe.style.transition = "opacity 1s ease";
  iframe.setAttribute("allowFullScreen", "");

  iframe.onload = async () => {
    setupMain(
      iframe.contentWindow,
      config,
      loadCSS,
      setupSource,
      fixPerspective,
      getUrl
    );
  };

  config.targetElement.appendChild(iframe);

  return iframe.contentWindow;
}
