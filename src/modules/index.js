import mapper from "./mapper/index.js";
const isChrome = window.chrome && navigator.vendor === "Google Inc.";
const isFirefox = navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
const isSupportedPlatform =
  ["MacIntel", "Win32"].indexOf(navigator.platform) > -1;

var hash;

const inExtension = (() => {
  if (window.chrome && window.chrome.extension) {
    return true;
  } else if (window.browser && window.browser.extension) {
    // Access extension apis via Chrome variable
    window.chrome = window.browser;
    return true;
  }
})();
const inBrowserActionPopup =
  inExtension &&
  chrome.extension.getViews({ type: "popup" }).indexOf(window) > -1;

const finishSetup = () => {
  document.body.classList.add("setup");
  addEventListener(
    "hashchange",
    () => {
      if (location.hash.substr(1) !== hash) {
        location.reload();
      }
    },
    false
  );
};

const cleanBody = () => {
  document.body.textContent = "";
  finishSetup();
};

const setHash = (newHash) => {
  location.hash = hash = newHash;
};

const errorHandler = (e, type) => {
  // Keep user gesture errors quite,
  // and redirect to the main menu where
  // user can click desired source.
  if (!e.message || e.message.indexOf("user gesture") === -1) {
    var message = `Error accessing ${type}. `;

    if (e.name === "NotAllowedError") {
      message += "Not allowed. Please grant permission.";
    } else {
      message += `${e.message || e.name}.`;
    }

    console.error(e);
    const errorEl = document.getElementById("error");
    errorEl && (errorEl.innerText = message);
  }

  setHash("/");
  finishSetup();
};

const getStateFromStore = () => {
  var state = localStorage.getItem("mappertje-last-state");
  if (!state) {
    return;
  }

  try {
    state = JSON.parse(state);
  } catch (e) {
    console.error(e);
    return;
  }

  return state;
};

const handleStream = (stream, type) => {
  setHash("/" + type);
  cleanBody();
  mapper({
    stream: stream,
    targetElement: document.body,
    initialState: getStateFromStore(),
    readyHandler: (myMapper) => {
      const unloadHandler = () => {
        localStorage.setItem(
          "mappertje-last-state",
          JSON.stringify(myMapper.getCurrentState())
        );
      };

      myMapper.addEventListener("unload", unloadHandler);

      // // Example of how to replace the stream
      // setTimeout(() => {
      //   navigator.mediaDevices
      //     .getUserMedia({
      //       video: {
      //         width: { ideal: 360 },
      //         height: { ideal: 180 },
      //       },
      //     })
      //     .then((stream) => {
      //       if (myMapper.getStream() !== stream) {
      //         myMapper.setStream(stream);
      //       }
      //     })
      //     .catch((e) => errorHandler(e, type));
      // }, 10000);
    },
  });
};

const getUserMedia = (constraints, type) => {
  if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => handleStream(stream, type))
      .catch((e) => errorHandler(e, type));
  }
};

const captureCamera = () => {
  getUserMedia(
    {
      video: {
        width: { ideal: 4096 },
        height: { ideal: 2160 },
      },
    },
    "camera"
  );
};

const captureScreen = () => {
  const type = "screen";
  if (
    inExtension &&
    chrome.desktopCapture &&
    chrome.desktopCapture.chooseDesktopMedia
  ) {
    return chrome.desktopCapture.chooseDesktopMedia(
      ["window", "screen"],
      (streamId) => {
        if (!streamId) {
          setHash("/");
          finishSetup();
          return;
        }

        getUserMedia(
          {
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: streamId,
              },
            },
          },
          type
        );
      }
    );
  }

  // For Firefox and Safari:
  // getDisplayMedia must be called from a user gesture handler.
  if (navigator.mediaDevices.getDisplayMedia) {
    navigator.mediaDevices
      .getDisplayMedia({
        video: true,
      })
      .then((stream) => handleStream(stream, type))
      .catch((e) => errorHandler(e, type));
  }
};

const openPopout = (type) => {
  window.open(
    location.href.replace(location.hash, "#/" + type),
    Date.now(),
    `status=no,menubar=no,width=${screen.availWidth},height=${screen.availHeight},left=${screen.availLeft},top=${screen.availTop}`
  );
};

const cameraClickHandler = () => {
  if (inBrowserActionPopup) {
    openPopout("camera");
  } else {
    captureCamera();
  }
};

const screenClickHandler = () => {
  if (inBrowserActionPopup) {
    openPopout("screen");
  } else {
    captureScreen();
  }
};

const init = () => {
  // Allow other script tags to access mapper,
  // so they can check if mapper loaded correctly.
  window.mapper = mapper;
  // Clear default error message
  document.getElementById("error").innerText = "";

  const cameraButton = document.getElementById("camera");
  cameraButton.disabled = false;
  cameraButton.onclick = cameraClickHandler;

  const screenButton = document.getElementById("screen");
  screenButton.disabled = false;
  screenButton.onclick = screenClickHandler;

  if (!(isSupportedPlatform && (isChrome || isFirefox))) {
    document.getElementById("warning").innerText =
      "Warning: Mappertje may not work on this platform. Supported platforms are the Chrome and Firefox desktop browsers for Windows 10 and MacOS.";
  }

  if (location.hash === "#/camera") {
    captureCamera();
  } else if (location.hash === "#/screen") {
    captureScreen();
  } else {
    setHash("/");
    finishSetup();
  }
};

init();

// TODO: make bug report about matrix3d in Safari giving different result than Chrome or Firefox
