var sourceCorrectMode = false;
var controllerVid, correctedVid, controlPoints;
var currentCorner = null;
var grabOffset = { x: 0, y: 0 };
var shouldDisableCornerResetButton = true;

const initialPointsPosition = [];

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

  const to = [0, 0, 0, rect2.height, rect2.width, 0, rect2.width, rect2.height];

  const from = [];
  const lineCorners = [];

  controlPoints.forEach((p) => {
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
  return controlPoints.map((p) => {
    return { top: p.style.top, left: p.style.left };
  });
};

window.resetCorners = () => {
  shouldDisableCornerResetButton = true;
  parent.cornerResetButton.disabled = shouldDisableCornerResetButton;

  controlPoints.forEach((p, index) => {
    const pos = initialPointsPosition[index];
    if (!pos) {
      return;
    }
    p.style.left = pos.left;
    p.style.top = pos.top;
  });
  applyTransform();
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

// Make setup available for parent window
window.setup = async (
  stream,
  video,
  initialCorners,
  loadErrorHandler,
  callback
) => {
  document.body.innerHTML = `
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

  await LoadCSS(getUrl("./css/source.css"), document, loadErrorHandler);

  controllerVid = video;
  controllerVid.muted = true;
  controllerVid.autoplay = true;

  document
    .querySelector("#video-and-corners-wrapper")
    .appendChild(controllerVid);

  const controller = document.getElementById("controller");
  controller.style.padding = parent.previewPaddingSize + "px";
  setupLines(controller);

  correctedVid = document.querySelector("#corrected-video");

  controllerVid.style.transform = "";
  correctedVid.style.transformOrigin = "0 0";
  controlPoints = Array.from(
    controllerVid.parentNode.querySelectorAll(".corner")
  );

  // Store default position as defined in HTML
  controlPoints.forEach((p, index) => {
    initialPointsPosition[index] = { top: p.style.top, left: p.style.left };
  });

  if (initialCorners) {
    var matchesDefaultPosition = true;

    controlPoints.forEach((p, index) => {
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

  setupCommonMouseHandlers(window);

  window.addEventListener("mousemove", move);
  window.addEventListener("keydown", keydownHandler);

  window.addEventListener("resize", update);
  controllerVid.addEventListener("resize", update);
  controllerVid.srcObject = correctedVid.srcObject = stream;

  typeof callback === "function" && callback();
};
