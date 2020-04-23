import mapper from "./mapper/index.js";

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
    var message;

    if (e.name === "NotAllowedError") {
      message = `Error: Not allowed to access ${type}. Please grant permission.`;
    } else {
      message = `Error: ${e.message || e.name}`;
    }

    document.getElementById("error").innerText = message;
    console.error(e);
  }

  setHash("/");
  finishSetup();
};

const handleStream = (stream, type) => {
  setHash("/" + type);
  cleanBody();
  mapper(stream, document.body);
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
  document.getElementById("camera").onclick = cameraClickHandler;
  document.getElementById("screen").onclick = screenClickHandler;

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

// TODO: make bug report about matrix3d in Safari giving different result than Chrome or Firefox,
// and make a little warning text when detecting Safari.
