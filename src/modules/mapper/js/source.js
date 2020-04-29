import html from "./join-template.js";

const template = html`
  <style>
    * {
      margin: 0;
      padding: 0;
      border: 0;
      -webkit-user-select: none; /* Safari */
      user-select: none;
      font-family: sans-serif;
    }

    html,
    body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }

    video {
      background: black;
      pointer-events: none;
      width: 100%;
      height: 100%;
      object-fit: fill;
    }

    .line {
      position: absolute;
      width: 2px;
      background: rgba(255, 255, 255, 0.5);
      border-radius: 2px;
      pointer-events: none;
      filter: drop-shadow(0 0 6px rgba(0, 0, 0, 0.75));
    }

    #line1,
    #line3 {
      margin-left: -1px;
    }

    #line2 {
      margin-left: -2px;
    }

    #controller {
      width: 100vw;
      height: 100vh;
      box-sizing: border-box;
      display: flex;
      justify-content: center;
      align-items: center;
      transform: scale(0);
      transition-property: transform;
      transition-duration: 0.25s;
      transition-timing-function: ease;
      transition-delay: 0s;
      overflow: visible;
    }

    html > body.sourceCorrectMode #controller {
      transform: scale(1);
      transition-delay: 0.25s;
    }

    #video-and-corners-wrapper {
      position: relative;
    }

    #result {
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      position: absolute;
      top: 0;
      left: 0;
    }

    #result:before {
      content: "Invalid source correction.";
      background: darkred;
      display: block;
      position: absolute;
      top: 2px;
      left: 2px;
      right: 2px;
      bottom: 2px;
      color: white;
      font-size: 5vw;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    html > body.guides:not(.sourceCorrectMode) #result:after {
      content: "Guides";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      font-size: 5vw;
      display: flex;
      align-items: center;
      justify-content: center;
      color: blue;
      background-color: white;
      background-size: calc(100% / 3 + 2px) calc(100% / 3 + 2px);
      background-image: linear-gradient(to right, blue 6px, transparent 6px),
        linear-gradient(to bottom, blue 6px, transparent 6px);
      background-position: -6px -6px;
    }

    html > body.sourceCorrectMode #result:before {
      content: "";
    }

    #result > * {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      transform-origin: 0 0;
      object-fit: fill;
    }

    .corner {
      width: 0;
      height: 0;
      cursor: grab;
      position: relative;
      z-index: 100000;
    }

    .corner.grabbing {
      cursor: grabbing;
    }

    .corner::after {
      transform: translate(-50%, -50%);
      width: 51px;
      height: 51px;
      content: "";
      display: block;
      border-radius: 51px;
      border: 20px solid rgba(0, 0, 255, 0.5);
      box-sizing: border-box;
      background: radial-gradient(circle, white 1px, transparent 1px);
      background-repeat: no-repeat;
      transition: border-color 0.25s ease;
    }

    .corner.grabbing::after {
      border-color: rgba(0, 0, 255, 0.25);
    }

    .corner.top-left::after {
      border-top-left-radius: 0;
    }

    .corner.bottom-left::after {
      border-bottom-left-radius: 0;
    }

    .corner.top-right::after {
      border-top-right-radius: 0;
    }

    .corner.bottom-right::after {
      border-bottom-right-radius: 0;
    }
  </style>
  <div id="result">
    <video id="corrected-video" muted autoplay />
  </div>
  <div id="controller">
    <div id="video-and-corners-wrapper">
      <div
        class="corner top-left"
        title="Top left"
        style="top: 0%; left: 0%;"
      ></div>
      <div
        class="corner bottom-left"
        title="Bottom left"
        style="top: 100%; left: 0%;"
      ></div>
      <div
        class="corner top-right"
        title="Top right"
        style="top: 0%; left: 100%;"
      ></div>
      <div
        class="corner bottom-right"
        title="Bottom right"
        style="top: 100%; left: 100%;"
      ></div>
    </div>
  </div>
`;

export default function setupSource(
  window,
  stream,
  video,
  initialCorners,
  previewPaddingSize,
  callback,
  transform2d,
  setupLines,
  adjustLines,
  keydownHandler,
  setupCommonMouseHandlers
) {
  const document = window.document;
  var sourceCorrectMode = false;
  var controllerVid;
  var correctedVid;
  const grabOffset = { x: 0, y: 0 };
  var currentCorner;
  var shouldDisableCornerResetButton = true;
  const initialPointsPosition = [];

  const setCurrentCorner = (newCorner) => {
    currentCorner = newCorner;
  };

  const rectWithoutTransform = (el) => {
    var offsetLeft = 0,
      offsetTop = 0,
      offsetWidth = el.offsetWidth,
      offsetHeight = el.offsetHeight;

    do {
      offsetLeft += el.offsetLeft;
      offsetTop += el.offsetTop;

      el = el.offsetParent;
    } while (el);

    return {
      x: offsetLeft,
      y: offsetTop,
      width: offsetWidth,
      height: offsetHeight,
    };
  };

  const applyTransform = () => {
    const rect1 = rectWithoutTransform(controllerVid.parentNode);
    const rect2 = rectWithoutTransform(correctedVid.parentNode);

    const to = [
      0,
      0,
      0,
      rect2.height,
      rect2.width,
      0,
      rect2.width,
      rect2.height,
    ];

    const from = [];
    const lineCorners = [];

    window.controlPoints.forEach((p) => {
      const pRect = rectWithoutTransform(p);
      // Get the position of the control points relative to the control image
      const relativeX = pRect.x - rect1.x;
      const relativeY = pRect.y - rect1.y;
      lineCorners.push(pRect.x);
      lineCorners.push(pRect.y);

      // Make the coordinates absolute to the target image
      const absoluteX = (relativeX / rect1.width || 0) * rect2.width;
      const absoluteY = (relativeY / rect1.height || 0) * rect2.height;

      from.push(absoluteX);
      from.push(absoluteY);
    });

    transform2d(correctedVid, from, to);
    adjustLines(lineCorners, document);
  };

  const update = () => {
    const Math = window.Math;

    const ratio = controllerVid.videoHeight / controllerVid.videoWidth;

    const box = document.querySelector("#video-and-corners-wrapper");
    const outerRect = rectWithoutTransform(box.parentNode);
    let height, width;

    if (outerRect.height > outerRect.width * ratio) {
      width = "100%";
      height = Math.round((outerRect.width - 80) * ratio) + "px";
    } else {
      height = "100%";
      width = Math.round((outerRect.height - 80) / ratio) + "px";
    }

    box.style.height = height;
    box.style.width = width;

    applyTransform();
  };

  const move = (e) => {
    if (currentCorner) {
      shouldDisableCornerResetButton = false;
      window.parent.cornerResetButton.disabled = shouldDisableCornerResetButton;

      const targetX = e.pageX - grabOffset.x;
      const targetY = e.pageY - grabOffset.y;

      const parent = currentCorner.parentNode;
      const parentRect = rectWithoutTransform(parent);

      // Get the position of the control point relative to the control image
      const relativeX = targetX - parentRect.x;
      const relativeY = targetY - parentRect.y;

      const left = (relativeX / parentRect.width) * 100;
      const top = (relativeY / parentRect.height) * 100;

      // Don't drag out of parent
      if (left <= 100 && left >= 0) {
        currentCorner.style.left = left.toFixed(20) + "%";
      }
      if (top <= 100 && top >= 0) {
        currentCorner.style.top = top.toFixed(20) + "%";
      }
      applyTransform();
    }
  };

  window.getCornersPosition = () => {
    return window.controlPoints.map((p) => {
      return { top: p.style.top, left: p.style.left };
    });
  };

  window.resetCorners = () => {
    shouldDisableCornerResetButton = true;
    window.parent.cornerResetButton.disabled = shouldDisableCornerResetButton;

    window.controlPoints.forEach((p, index) => {
      const pos = initialPointsPosition[index];
      if (!pos) {
        return;
      }
      p.style.left = pos.left;
      p.style.top = pos.top;
    });
    applyTransform();
  };

  window.toggleGuides = () => {
    document.body.classList.toggle("guides");
  };

  // Make sourceCorrect available for parent window
  window.sourceCorrect = (newState) => {
    sourceCorrectMode = newState;
    if (sourceCorrectMode) {
      controllerVid.play();
      document.body.classList.add("sourceCorrectMode");
      window.focus();
    } else {
      document.body.classList.remove("sourceCorrectMode");
      window.parent.focus();
      controllerVid.pause();
    }
  };

  window.setStream = (stream) => {
    controllerVid.srcObject = correctedVid.srcObject = stream;
  };

  // Make setup available for parent window
  const setup = async () => {
    document.body.innerHTML = template;

    controllerVid = video;
    controllerVid.muted = true;
    controllerVid.autoplay = true;

    document
      .querySelector("#video-and-corners-wrapper")
      .appendChild(controllerVid);

    const controller = document.getElementById("controller");
    controller.style.padding = previewPaddingSize + "px";
    setupLines(controller);

    correctedVid = document.querySelector("#corrected-video");

    controllerVid.style.transform = "";
    correctedVid.style.transformOrigin = "0 0";
    window.controlPoints = window.Array.from(
      controllerVid.parentNode.querySelectorAll(".corner")
    );

    // Store default position as defined in HTML
    window.controlPoints.forEach((p, index) => {
      initialPointsPosition[index] = { top: p.style.top, left: p.style.left };
    });

    if (initialCorners) {
      var matchesDefaultPosition = true;

      window.controlPoints.forEach((p, index) => {
        const position = initialCorners[index];
        p.style.top = position.top;
        p.style.left = position.left;
        if (
          position.top !== initialPointsPosition[index].top ||
          position.left !== initialPointsPosition[index].left
        ) {
          matchesDefaultPosition = false;
        }
      });

      if (!matchesDefaultPosition) {
        shouldDisableCornerResetButton = false;
        if (sourceCorrectMode) {
          parent.cornerResetButton.disabled = shouldDisableCornerResetButton;
        }
      }

      applyTransform();
    }

    setupCommonMouseHandlers(window, grabOffset, setCurrentCorner);

    window.addEventListener("mousemove", move);
    window.addEventListener("keydown", keydownHandler);

    window.addEventListener("resize", update);
    controllerVid.addEventListener("resize", update);
    window.setStream(stream);

    typeof callback === "function" && callback();
  };

  setup();
}
