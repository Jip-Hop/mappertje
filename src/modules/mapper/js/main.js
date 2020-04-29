import html from "./join-template.js";

const inactiveDelay = 2000;
const previewPaddingSize = 40; // in pixels

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
    html > body {
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }

    html > body {
      position: relative;
    }

    html > body.correctingSource:not(.transition) {
      overflow: auto;
    }

    #sourceIframe {
      position: absolute;
      top: 0px;
      left: 0px;
      transform-origin: 0 0;
      overflow: hidden;
    }

    .corner,
    .line,
    #buttonsContainer {
      transition-property: opacity;
      transition-duration: 0.25s;
      transition-timing-function: ease;
    }

    .corner {
      position: absolute;
      width: 100px;
      height: 100px;
      background-color: rgba(0, 0, 255, 0.5);
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1000'%3e%3cpath d='M908.1 264.8V10H10v898.1h254.8V428.5L826.3 990 990 826.3 428.5 264.8z' fill='%23fff'/%3e%3c/svg%3e");
      border-radius: 100%;
      transform: translate(-50%, -50%);
      text-align: center;
      font-size: 50px;
      cursor: grab;
      z-index: 1;
      background-size: 25%;
      background-position: center;
      background-repeat: no-repeat;
    }

    .corner.tr {
      transform: translate(-50%, -50%) rotate(90deg);
    }

    .corner.br {
      transform: translate(-50%, -50%) rotate(180deg);
    }

    .corner.bl {
      transform: translate(-50%, -50%) rotate(-90deg);
    }

    .corner.grabbing {
      cursor: grabbing;
    }

    html > body:not(.polygonError) .corner.grabbing {
      background-image: none;
      opacity: 0.5;
      z-index: unset;
    }

    iframe {
      pointer-events: none;
    }

    .correctingSource iframe {
      pointer-events: all;
      transform: none !important;
    }

    html > body.transition * {
      opacity: 0 !important;
      pointer-events: none !important;
    }

    html > body.transition iframe {
      opacity: 1 !important;
      transition: transform 0.5s ease;
    }

    .line {
      position: absolute;
      background: white;
      pointer-events: none;
      border-radius: 2px;
      border-left: 2px solid transparent;
      box-shadow: 0 0 1px rgba(255, 255, 255, 0); /* anti aliasing for Chrome on Windows */
    }

    #line1,
    #line3 {
      margin-left: -1px;
    }

    #line2 {
      margin-left: -2px;
    }

    .boundsError .line {
      background: orange;
    }

    .boundsError .corner {
      background-color: rgba(255, 165, 0, 0.5);
    }

    .polygonError .line {
      background: red;
    }

    .polygonError .corner {
      background-color: rgba(255, 0, 0, 0.5);
    }

    .polygonError:not(.correctingSource) iframe {
      visibility: hidden;
    }

    #buttonsContainer {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    #buttonsContainer > button {
      position: relative;
      z-index: 1;
      padding: 5px;
      margin: 2.5px;
      background: white;
      color: #aaa;
    }

    #buttonsContainer > button:not(:disabled) {
      cursor: pointer;
      background: blue;
      color: white;
    }

    #buttonsContainer > button > .shortcuts {
      font-family: monospace;
      color: darkgray;
    }

    html
      > body:not(.correctingSource)
      #sourceCorrectButton
      > span.sourceCorrect {
      display: none;
    }

    html > body.correctingSource > *:not(.sourceCorrect) {
      display: none;
    }

    html > body.correctingSource #guidesButton {
      display: none;
    }

    html
      > body.correctingSource
      #sourceCorrectButton
      > *:not(.sourceCorrect):not(.shortcuts) {
      display: none;
    }

    .inactive .line,
    .inactive .corner,
    html > body.inactive:not(.correctingSource) #buttonsContainer {
      opacity: 0;
      pointer-events: none;
    }

    html > body.inactive,
    html > body.inactive * {
      cursor: none;
    }
  </style>
  <div id="marker0" class="corner tl"></div>
  <div id="marker2" class="corner tr"></div>
  <div id="marker4" class="corner bl"></div>
  <div id="marker6" class="corner br"></div>
  <div id="buttonsContainer" class="sourceCorrect">
    <button id="cornerReset">
      Reset Corners <span class="shortcuts">R</span>
    </button>
    <button id="sourceCorrectButton">
      Correct <span>Source</span> <span class="sourceCorrect">Target</span>
      <span class="shortcuts">Tab</span>
    </button>
    <button id="guidesButton">
      Toggle Guides <span class="shortcuts">G</span>
    </button>
    <button id="fullScreenButton">
      Full Screen Toggle <span class="shortcuts">Enter</span>
    </button>
  </div>
`;

export default function setupMain(
  window,
  config,
  setupSource,
  fixPerspective
) {
  const document = window.document;
  var corners;
  var currentCorner;
  const grabOffset = { x: 0, y: 0 };
  var polygonError = false;
  var boundsError = false;
  var screenWidth;
  var screenHeight;
  var currentStream;
  var correctingSource = false;
  var shouldDisableCornerResetButton = true;
  var userInactiveTimer;
  var videoElement;
  var sourceIframe;
  var sourceCorrectButton;
  var cornerResetButton;

  const setCurrentCorner = (newCorner) => {
    currentCorner = newCorner;
  };

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
      const contained =
        x >= 0 && x <= clientWidth && y >= 0 && y <= clientHeight;

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
    const H = fixPerspective(srcCorners, dstCorners);
    const t = "matrix3d(" + H.join(", ") + ")";
    elt.style.transform = t;
  };

  const adjustLine = (from, to, line) => {
    const Math = window.Math;

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

    if (screenWidth !== window.screen.width) {
      screenWidth = window.screen.width;
      sourceIframe.style.width = screenWidth + "px";
      changed = true;
    }

    if (screenHeight !== window.screen.height) {
      screenHeight = window.screen.height;
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

    const currentPolygonError = haspolygonError();
    if (currentPolygonError !== polygonError) {
      if (currentPolygonError) {
        document.body.classList.add("polygonError");
      } else {
        document.body.classList.remove("polygonError");
      }
      polygonError = currentPolygonError;
    }
  };

  const move = (e) => {
    scheduleUserInactive();

    if (currentCorner) {
      const targetX = e.pageX - grabOffset.x;
      const targetY = e.pageY - grabOffset.y;
      shouldDisableCornerResetButton = false;
      cornerResetButton.disabled = shouldDisableCornerResetButton;
      const cornerIndex = window.parseInt(
        currentCorner.id.slice("marker".length)
      );
      // Don't drag out of viewport
      if (targetX <= document.documentElement.clientWidth && targetX >= 0) {
        corners[cornerIndex] = targetX;
      }
      if (targetY <= document.documentElement.clientHeight && targetY >= 0) {
        corners[cornerIndex + 1] = targetY;
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
    window.clearTimeout(userInactiveTimer);
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
    window.clearTimeout(userInactiveTimer);
    document.body.classList.remove("inactive");
    userInactiveTimer = window.setTimeout(() => {
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

  const setupCommonMouseHandlers = (win, grabOffset, setCurrentCorner) => {
    win.addEventListener("mouseup", () => {
      scheduleUserInactive();
      setCurrentCorner(null);
      win.document.querySelectorAll(".grabbing").forEach((el) => {
        el.classList.remove("grabbing");
      });
    });

    win.addEventListener("mousedown", (e) => {
      scheduleUserInactive();
      if (win.controlPoints.indexOf(e.target) > -1) {
        setCurrentCorner(e.target);
        const target = e.target;
        target.classList.add("grabbing");

        var rect = target.getBoundingClientRect();
        // x and y position within the element relative to its center
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;

        grabOffset.x = x;
        grabOffset.y = y;
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

  const setup = async (config) => {
    const {
      stream,
      beforeUnloadHandler,
      unloadHandler,
      initialState,
    } = config;

    currentStream = stream;

    var initialTargetCorners, initialSourceCorners;
    if (initialState) {
      if (
        initialState.targetCorners &&
        window.Array.isArray(initialState.targetCorners) &&
        initialState.targetCorners.length === 8
      ) {
        initialTargetCorners = initialState.targetCorners;
      }
      if (
        initialState.sourceCorners &&
        window.Array.isArray(initialState.sourceCorners) &&
        initialState.sourceCorners.length === 4
      ) {
        initialSourceCorners = initialState.sourceCorners;
      }
    }

    document.body.innerHTML = template;

    window.controlPoints = window.Array.from(
      document.body.querySelectorAll(".corner")
    );

    sourceIframe = document.createElement("iframe");
    sourceIframe.id = "sourceIframe";
    sourceIframe.classList.add("sourceCorrect");
    sourceIframe.addEventListener("transitionend", transitionEndHandler);

    sourceIframe.onload = async () => {
      setupLines(document.body);

      // TODO: also handle other sources, like video element.
      // In case of a video element we'd have to use a canvas inside
      // #controller-video-wrapper (in source.js) instead of a second
      // video element. This to ensure we keep showing what's actually
      // played by the video (in case its src or srcObject changes)

      videoElement = sourceIframe.contentDocument.createElement("video");

      const firstPlayHandler = () => {
        videoElement.removeEventListener("canplay", firstPlayHandler);
        // Fade in
        window.frameElement.style.opacity = 1;
      };
      videoElement.addEventListener("canplay", firstPlayHandler);

      setupSource(
        sourceIframe.contentWindow,
        currentStream,
        videoElement,
        initialSourceCorners,
        previewPaddingSize,
        () => {
          sourceIframe &&
            sourceIframe.contentWindow &&
            sourceIframe.contentWindow.sourceCorrect &&
            sourceIframe.contentWindow.sourceCorrect(correctingSource);
        },
        transform2d,
        setupLines,
        adjustLines,
        keydownHandler,
        setupCommonMouseHandlers
      );

      document.getElementById("buttonsContainer").style.height =
        previewPaddingSize + "px";
      window.cornerResetButton = cornerResetButton = document.querySelector(
        "#cornerReset"
      );
      sourceCorrectButton = document.querySelector("#sourceCorrectButton");

      const guidesButton = document.querySelector("#guidesButton");
      const fullScreenButton = document.querySelector("#fullScreenButton");
      cornerResetButton.disabled = shouldDisableCornerResetButton;

      initCorners(initialTargetCorners);

      cornerResetButton.onclick = () => initCorners();
      sourceCorrectButton.onclick = toggleSourceCorrect;
      guidesButton.onclick = toggleGuides;
      fullScreenButton.onclick = toggleFullScreen;

      // Poll for screen resolution changes
      window.setInterval(updateResolution, 1000);

      window.onresize = () => {
        shouldDisableCornerResetButton = false;

        if (!correctingSource) {
          cornerResetButton.disabled = shouldDisableCornerResetButton;
        }

        hasBoundsError();
      };

      window.addEventListener("mousemove", move);
      setupCommonMouseHandlers(window, grabOffset, setCurrentCorner);
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

  setup(config);
}
