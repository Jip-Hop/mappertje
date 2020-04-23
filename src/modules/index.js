import mapper from "./mapper/index.js";

var hash;

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
  if (e.message.indexOf("user gesture") === -1) {
    var message;

    if (e.name === "NotAllowedError") {
      message = `Error: Not allowed to access ${type}. Please grant permission.`;
    } else {
      message = `Error: ${e.message}`;
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

const captureCamera = () => {
  const type = "camera";
  if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({
        video: {
          width: { ideal: 4096 },
          height: { ideal: 2160 },
        },
      })
      .then((stream) => handleStream(stream, type))
      .catch((e) => errorHandler(e, type));
  }
};

const captureScreen = () => {
  const type = "screen";
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

const inExtension = () => {
  return (chrome && chrome.runtime) || (browser && browser.runtime);
};

const openPopout = (type) => {
  window.open(
    location.href.replace(location.hash, "#/" + type),
    Date.now(),
    `status=no,menubar=no,width=${screen.width},height=${screen.height},left=0,top=0`
  );
};

const cameraClickHandler = () => {
  if (inExtension()) {
    openPopout("camera");
  } else {
    captureCamera();
  }
};

const screenClickHandler = () => {
  if (inExtension()) {
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
