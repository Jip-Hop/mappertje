import fixPerspective from "./js/css3-perspective.js";
import setupMain from "./js/main.js";
import setupSource from "./js/source.js";

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
      setupSource,
      fixPerspective
    );
  };

  config.targetElement.appendChild(iframe);

  // TODO: make a setup ready callback
  return iframe.contentWindow;
}
