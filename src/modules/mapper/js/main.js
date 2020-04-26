const inactiveDelay = 2000;

var previewPaddingSize = 40; // in pixels, use var not const else source.js can't access this value

var corners;
var grabOffset = { x: 0, y: 0 };
var polygonError = false;
var boundsError = false;
var controlPoints;
var currentCorner;
var screenWidth, screenHeight;

var currentStream;

var correctingSource = false;
var shouldDisableCornerResetButton = true;

var userInactiveTimer;

// https://www.kirupa.com/html5/drag.htm
var videoElement, sourceIframe, sourceCorrectButton, cornerResetButton;

// Get the determinant of given 3 points
const getDeterminant = (p0, p1, p2) => {
  return (
    p0.x * p1.y +
    p1.x * p2.y +
    p2.x * p0.y -
    p0.y * p1.x -
    p1.y * p2.x -
    p2.y * p0.x
  );
};

const hasBoundsError = () => {
  const clientWidth = document.documentElement.clientWidth;
  const clientHeight = document.documentElement.clientHeight;
  var currentBoundsError = false;
  for (var i = 0; i != 8; i += 2) {
    const x = corners[i];
    const y = corners[i + 1];
    const contained = x >= 0 && x <= clientWidth && y >= 0 && y <= clientHeight;

    if (!contained) {
      currentBoundsError = true;
      break;
    }
  }

  if (currentBoundsError !== boundsError) {
    if (currentBoundsError) {
      document.body.classList.add("boundsError");
    } else {
      document.body.classList.remove("boundsError");
    }
    boundsError = currentBoundsError;
  }
};

// Return true if it is a concave polygon. Otherwise return true;
const haspolygonError = () => {
  var det1 = getDeterminant(
    // Topleft
    { x: corners[0], y: corners[1] },
    // Topright
    { x: corners[2], y: corners[3] },
    // Bottomright
    { x: corners[6], y: corners[7] }
  );
  var det2 = getDeterminant(
    // Bottomright
    { x: corners[6], y: corners[7] },
    // Bottomleft
    { x: corners[4], y: corners[5] },
    // Topleft
    { x: corners[0], y: corners[1] }
  );

  if (det1 * det2 <= 0) return true;

  var det1 = getDeterminant(
    // Topright
    { x: corners[2], y: corners[3] },
    // Bottomright
    { x: corners[6], y: corners[7] },
    // Bottomleft
    { x: corners[4], y: corners[5] }
  );
  var det2 = getDeterminant(
    // Bottomleft
    { x: corners[4], y: corners[5] },
    // Topleft
    { x: corners[0], y: corners[1] },
    // Topright
    { x: corners[2], y: corners[3] }
  );

  if (det1 * det2 <= 0) return true;

  return false;
};

const transform2d = (elt, srcCorners, dstCorners) => {
  const h = PerspT(srcCorners, dstCorners).coeffs;

  const H = [
    h[0],
    h[3],
    0,
    h[6],
    h[1],
    h[4],
    0,
    h[7],
    0,
    0,
    1,
    0,
    h[2],
    h[5],
    0,
    h[8],
  ];

  const t = "matrix3d(" + H.join(", ") + ")";
  elt.style.transform = t;
};

// https://stackoverflow.com/a/36045181
const adjustLine = (from, to, line) => {
  var fT = from.y;
  var tT = to.y;
  var fL = from.x;
  var tL = to.x;

  var CA = Math.abs(tT - fT);
  var CO = Math.abs(tL - fL);
  var H = Math.sqrt(CA * CA + CO * CO);
  var ANG = (180 / Math.PI) * Math.acos(CA / H);

  if (tT > fT) {
    var top = (tT - fT) / 2 + fT;
  } else {
    var top = (fT - tT) / 2 + tT;
  }
  if (tL > fL) {
    var left = (tL - fL) / 2 + fL;
  } else {
    var left = (fL - tL) / 2 + tL;
  }

  if (
    (fT < tT && fL < tL) ||
    (tT < fT && tL < fL) ||
    (fT > tT && fL > tL) ||
    (tT > fT && tL > fL)
  ) {
    ANG *= -1;
  }
  top -= H / 2;

  line.style.transform = "rotate(" + ANG + "deg)";
  line.style.top = top + "px";
  line.style.left = left + "px";
  line.style.height = H + "px";
};

const adjustLines = (corners, document) => {
  adjustLine(
    { x: corners[0], y: corners[1] },
    { x: corners[2], y: corners[3] },
    document.getElementById("line1")
  );

  adjustLine(
    { x: corners[2], y: corners[3] },
    { x: corners[6], y: corners[7] },
    document.getElementById("line2")
  );

  adjustLine(
    { x: corners[6], y: corners[7] },
    { x: corners[4], y: corners[5] },
    document.getElementById("line3")
  );

  adjustLine(
    { x: corners[0], y: corners[1] },
    { x: corners[4], y: corners[5] },
    document.getElementById("line4")
  );
};

const updateResolution = () => {
  var changed = false;

  if (screenWidth !== screen.width) {
    screenWidth = screen.width;
    sourceIframe.style.width = screenWidth + "px";
    changed = true;
  }

  if (screenHeight !== screen.height) {
    screenHeight = screen.height;
    sourceIframe.style.height = screenHeight + "px";
    changed = true;
  }

  if (changed) {
    update();
  }

  return changed;
};

const update = () => {
  var w = sourceIframe.offsetWidth,
    h = sourceIframe.offsetHeight;

  const from = [0, 0, w, 0, 0, h, w, h];
  const to = corners;

  transform2d(sourceIframe, from, to);

  for (var i = 0; i != 8; i += 2) {
    var elt = document.getElementById("marker" + i);
    elt.style.left = corners[i] + "px";
    elt.style.top = corners[i + 1] + "px";
  }

  adjustLines(to, document);

  const currentpolygonError = haspolygonError();
  if (currentpolygonError !== polygonError) {
    if (currentpolygonError) {
      document.body.classList.add("polygonError");
    } else {
      document.body.classList.remove("polygonError");
    }
    polygonError = currentpolygonError;
  }
};

const move = (e) => {
  scheduleUserInactive();

  if (currentCorner) {
    const targetX = e.pageX - grabOffset.x;
    const targetY = e.pageY - grabOffset.y;
    shouldDisableCornerResetButton = false;
    cornerResetButton.disabled = shouldDisableCornerResetButton;
    const cornetIndex = parseInt(currentCorner.id.slice("marker".length));
    // Don't drag out of viewport
    if (targetX <= document.documentElement.clientWidth && targetX >= 0) {
      corners[cornetIndex] = targetX;
    }
    if (targetY <= document.documentElement.clientHeight && targetY >= 0) {
      corners[cornetIndex + 1] = targetY;
    }
    update();
  }
};

const initCorners = (initialTargetCorners) => {
  if (correctingSource) {
    sourceIframe &&
      sourceIframe.contentWindow &&
      sourceIframe.contentWindow.resetCorners &&
      sourceIframe.contentWindow.resetCorners();
    return;
  }

  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  const left = 0;
  const top = 0;
  const right = viewportWidth + left;
  const bottom = viewportHeight + top;

  const newCorners = [left, top, right, top, left, bottom, right, bottom];

  if (initialTargetCorners) {
    var matchesDefaultPosition = true;
    for (let i = 0; i < initialTargetCorners.length; i++) {
      if (initialTargetCorners[i] !== newCorners[i]) {
        matchesDefaultPosition = false;
        break;
      }
    }

    corners = initialTargetCorners;
    shouldDisableCornerResetButton = matchesDefaultPosition;
  } else {
    corners = newCorners;
    shouldDisableCornerResetButton = true;
  }

  cornerResetButton.disabled = shouldDisableCornerResetButton;

  // Prevent calling update twice, only if size hasn't changed
  if (!updateResolution()) {
    update();
  }
  hasBoundsError();
};

const setupLines = (targetElement) => {
  for (let i = 1; i < 5; i++) {
    const div = document.createElement("div");
    div.className = "line";
    div.id = "line" + i;
    targetElement.appendChild(div);
  }
};

const transitionEndHandler = () => {
  document.body.classList.remove("transition");
};

const setInactiveImmediately = () => {
  clearTimeout(userInactiveTimer);
  document.body.classList.add("inactive");
};

const startSourceCorrect = () => {
  correctingSource = true;
  document.body.classList.add("correctingSource", "transition");

  cornerResetButton.disabled =
    sourceIframe &&
    sourceIframe.contentWindow &&
    sourceIframe.contentWindow.shouldDisableCornerResetButton;

  // Stay inactive
  setInactiveImmediately();

  sourceIframe &&
    sourceIframe.contentWindow &&
    sourceIframe.contentWindow.sourceCorrect &&
    sourceIframe.contentWindow.sourceCorrect(correctingSource);
};

const endSourceCorrect = () => {
  correctingSource = false;
  document.body.classList.add("transition");
  document.body.classList.remove("correctingSource");
  document.body.scrollTop = 0;
  document.body.scrollLeft = 0;
  cornerResetButton.disabled = shouldDisableCornerResetButton;
  // Start as inactive
  scheduleUserInactive();
  document.body.classList.add("inactive");
  sourceIframe &&
    sourceIframe.contentWindow &&
    sourceIframe.contentWindow.sourceCorrect &&
    sourceIframe.contentWindow.sourceCorrect(correctingSource);
};

const toggleGuides = () => {
  sourceIframe &&
    sourceIframe.contentWindow &&
    sourceIframe.contentWindow.toggleGuides &&
    sourceIframe.contentWindow.toggleGuides();
};

const toggleSourceCorrect = () => {
  if (correctingSource) {
    endSourceCorrect();
  } else {
    startSourceCorrect();
  }
};

const scheduleUserInactive = () => {
  if (!document.hasFocus()) {
    setInactiveImmediately();
    return;
  }

  // User inactive doesn't apply in source correct mode
  if (correctingSource) {
    return;
  }
  clearTimeout(userInactiveTimer);
  document.body.classList.remove("inactive");
  userInactiveTimer = setTimeout(() => {
    document.body.classList.add("inactive");
  }, inactiveDelay);
};

const toggleFullScreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
};

const setupCommonMouseHandlers = (win) => {
  win.addEventListener("mouseup", () => {
    scheduleUserInactive();
    win.currentCorner = null;
    win.document.querySelectorAll(".grabbing").forEach((el) => {
      el.classList.remove("grabbing");
    });
  });

  win.addEventListener("mousedown", (e) => {
    scheduleUserInactive();
    if (win.controlPoints.indexOf(e.target) > -1) {
      win.currentCorner = e.target;
      const target = e.target;
      target.classList.add("grabbing");

      var rect = target.getBoundingClientRect();
      // x and y position within the element relative to its center
      var x = e.clientX - rect.left - rect.width / 2;
      var y = e.clientY - rect.top - rect.height / 2;

      win.grabOffset = { x: x, y: y };
    }
  });
};

const keydownHandler = (e) => {
  scheduleUserInactive();

  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
    // Don't do anything if one of these keys are pressed
    return;
  }

  if (e.key === "Tab") {
    // Toggle correction mode
    e.preventDefault();
    toggleSourceCorrect();
  } else if (e.key === "Enter") {
    // Toggle fullscreen
    e.preventDefault();
    toggleFullScreen();
  } else if (e.key === "r") {
    // Reload if "r" is pressed without a meta, ctrl, alt or shift.
    // We don't want to initCorners() on cmd+r for a page reload.
    e.preventDefault();
    initCorners();
  } else if (e.key === "g" && !correctingSource) {
    e.preventDefault();
    toggleGuides();
  }
};

window.setStream = (stream) => {
  currentStream = stream;
  sourceIframe &&
    sourceIframe.contentWindow &&
    sourceIframe.contentWindow.setStream &&
    sourceIframe.contentWindow.setStream(currentStream);
};

window.getStream = () => {
  return currentStream;
};

window.getCurrentState = () => {
  return {
    targetCorners: corners,
    sourceCorners:
      sourceIframe &&
      sourceIframe.contentWindow &&
      sourceIframe.contentWindow.getCornersPosition &&
      sourceIframe.contentWindow.getCornersPosition(),
  };
};

// TODO: identify the corners based on 4 colors,
// also put those 4 colors in the corners of the black background as reference.
// Hide those colors on inactive.

window.setup = async (config) => {
  const {
    stream,
    beforeUnloadHandler,
    unloadHandler,
    loadErrorHandler,
    initialState,
  } = config;

  currentStream = stream;

  var initialTargetCorners, initialSourceCorners;
  if (initialState) {
    if (
      initialState.targetCorners &&
      Array.isArray(initialState.targetCorners) &&
      initialState.targetCorners.length === 8
    ) {
      initialTargetCorners = initialState.targetCorners;
    }
    if (
      initialState.sourceCorners &&
      Array.isArray(initialState.sourceCorners) &&
      initialState.sourceCorners.length === 4
    ) {
      initialSourceCorners = initialState.sourceCorners;
    }
  }
  document.body.innerHTML = `
  <div id="marker0" class="corner tl"></div>
  <div id="marker2" class="corner tr"></div>
  <div id="marker4" class="corner bl"></div>
  <div id="marker6" class="corner br"></div>
  <div id="buttonsContainer" class="sourceCorrect">
    <button id="cornerReset">
    Reset Corners <span class="shortcuts">R</span>
    </button>
    <button id="sourceCorrectButton">
      Correct <span>Source</span> <span class="sourceCorrect">Target</span> <span class="shortcuts">Tab</span>
    </button>
    <button id="guidesButton">
      Toggle Guides <span class="shortcuts">G</span>
    </button>
    <button id="fullScreenButton">
      Full Screen Toggle <span class="shortcuts">Enter</span>
    </button>
  </div>
  `;

  await LoadCSS(getUrl("./css/main.css"), document, config.loadErrorHandler);

  controlPoints = Array.from(document.body.querySelectorAll(".corner"));

  await loadScript(
    getUrl("./js/perspective-transform.min.js"),
    document,
    config.loadErrorHandler
  );

  sourceIframe = document.createElement("iframe");
  sourceIframe.id = "sourceIframe";
  sourceIframe.classList.add("sourceCorrect");
  sourceIframe.addEventListener("transitionend", transitionEndHandler);

  sourceIframe.onload = async () => {
    setupLines(document.body);

    await loadScript(
      getUrl("./js/source.js"),
      sourceIframe.contentDocument,
      config.loadErrorHandler
    );

    // Make methods available for iframe
    attachFunctionsToWindow(
      [
        LoadCSS,
        transform2d,
        setupLines,
        adjustLines,
        toggleSourceCorrect,
        keydownHandler,
        setupCommonMouseHandlers,
        getUrl,
        attachFunctionsToWindow,
      ],
      sourceIframe.contentWindow
    );

    // TODO: also handle other sources, like video element.
    // In case of a video element we'd have to use a canvas inside
    // #controller-video-wrapper (in source.js) instead of a second
    // video element. This to ensure we keep showing what's actually
    // played by the video (in case its src or srcObject changes)

    videoElement = sourceIframe.contentDocument.createElement("video");

    const firstPlayHandler = () => {
      videoElement.removeEventListener("canplay", firstPlayHandler);
      // Fade in
      frameElement.style.opacity = 1;
    };
    videoElement.addEventListener("canplay", firstPlayHandler);

    sourceIframe.contentWindow.setup(
      currentStream,
      videoElement,
      initialSourceCorners,
      loadErrorHandler,
      () => {
        sourceIframe &&
          sourceIframe.contentWindow &&
          sourceIframe.contentWindow.sourceCorrect &&
          sourceIframe.contentWindow.sourceCorrect(correctingSource);
      }
    );

    document.getElementById("buttonsContainer").style.height =
      previewPaddingSize + "px";
    cornerResetButton = document.querySelector("#cornerReset");
    sourceCorrectButton = document.querySelector("#sourceCorrectButton");
    guidesButton = document.querySelector("#guidesButton");
    fullScreenButton = document.querySelector("#fullScreenButton");
    cornerResetButton.disabled = shouldDisableCornerResetButton;

    initCorners(initialTargetCorners);

    cornerResetButton.onclick = () => initCorners();
    sourceCorrectButton.onclick = toggleSourceCorrect;
    guidesButton.onclick = toggleGuides;
    fullScreenButton.onclick = toggleFullScreen;

    // Poll for screen resolution changes
    setInterval(updateResolution, 1000);

    window.onresize = () => {
      shouldDisableCornerResetButton = false;

      if (!correctingSource) {
        cornerResetButton.disabled = shouldDisableCornerResetButton;
      }

      hasBoundsError();
    };

    window.addEventListener("mousemove", move);
    setupCommonMouseHandlers(window);
    window.addEventListener("keydown", keydownHandler);
    window.addEventListener("blur", () => {
      setInactiveImmediately();
    });

    if (typeof beforeUnloadHandler === "function") {
      window.addEventListener("beforeunload", beforeUnloadHandler);
    }

    if (typeof unloadHandler === "function") {
      window.addEventListener("unload", unloadHandler);
    }

    scheduleUserInactive();
  };

  sourceIframe.src = "about:blank";
  document.body.prepend(sourceIframe);
};
