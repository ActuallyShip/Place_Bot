// ==UserScript==
// @name         Guya Bot
// @namespace    https://github.com/ActuallyShip/Bot
// @version      22
// @description  Guya Bot
// @author       Actuallyship
// @match        https://www.reddit.com/r/place/*
// @match        https://new.reddit.com/r/place/*
// @connect      reddit.com
// @connect      cnc.f-ck.me
// @icon         https://www.google.com/s2/favicons?sz=64&domain=reddit.com
// @require	     https://cdn.jsdelivr.net/npm/toastify-js
// @resource     TOASTIFY_CSS https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css
// @updateURL    https://github.com/ActuallyShip/Place_Bot/raw/main/guyaplacebot.user.js
// @downloadURL  https://github.com/ActuallyShip/Place_Bot/raw/main/guyaplacebot.user.js
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// ==/UserScript==

var socket;
var order = undefined;
var accessToken;
var currentOrderCanvas = document.createElement("canvas");
var currentOrderCtx = currentOrderCanvas.getContext("2d");
var currentPlaceCanvas = document.createElement("canvas");

// Global constants
const DEFAULT_TOAST_DURATION_MS = 10000;

const COLOR_MAPPINGS = {
  "#6D001A": 0,
  "#BE0039": 1,
  "#FF4500": 2,
  "#FFA800": 3,
  "#FFD635": 4,
  "#FFF8B8": 5,
  "#00A368": 6,
  "#00CC78": 7,
  "#7EED56": 8,
  "#00756F": 9,
  "#009EAA": 10,
  "#00CCC0": 11,
  "#2450A4": 12,
  "#3690EA": 13,
  "#51E9F4": 14,
  "#493AC1": 15,
  "#6A5CFF": 16,
  "#94B3FF": 17,
  "#811E9F": 18,
  "#B44AC0": 19,
  "#E4ABFF": 20,
  "#DE107F": 21,
  "#FF3881": 22,
  "#FF99AA": 23,
  "#6D482F": 24,
  "#9C6926": 25,
  "#FFB470": 26,
  "#000000": 27,
  "#515252": 28,
  "#898D90": 29,
  "#D4D7D9": 30,
  "#FFFFFF": 31,
};

let getRealWork = (rgbaOrder) => {
  let order = [];
  for (var i = 0; i < 4000000; i++) {
    if (rgbaOrder[i * 4 + 3] !== 0) {
      order.push(i);
    }
  }
  return order;
};

let getPendingWork = (work, rgbaOrder, rgbaCanvas) => {
  let pendingWork = [];
  for (const i of work) {
    if (rgbaOrderToHex(i, rgbaOrder) !== rgbaOrderToHex(i, rgbaCanvas)) {
      pendingWork.push(i);
    }
  }
  return pendingWork;
};

(async function () {
  GM_addStyle(GM_getResourceText("TOASTIFY_CSS"));
  currentOrderCanvas.width = 2000;
  currentOrderCanvas.height = 2000;
  currentOrderCanvas.style.display = "none";
  currentOrderCanvas = document.body.appendChild(currentOrderCanvas);
  currentPlaceCanvas.width = 2000;
  currentPlaceCanvas.height = 2000;
  currentPlaceCanvas.style.display = "none";
  currentPlaceCanvas = document.body.appendChild(currentPlaceCanvas);

  Toastify({
    text: "Retrieving token...",
    duration: DEFAULT_TOAST_DURATION_MS,
  }).showToast();
  accessToken = await getAccessToken();
  Toastify({
    text: "Token retrieved!",
    duration: DEFAULT_TOAST_DURATION_MS,
  }).showToast();

  connectSocket();
  attemptPlace();

  setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify({ type: "ping" }));
  }, 5000);
  setInterval(async () => {
    accessToken = await getAccessToken();
  }, 30 * 60 * 1000);
})();

function connectSocket() {
  Toastify({
    text: "Connecting to Guya HQ...",
    duration: DEFAULT_TOAST_DURATION_MS,
  }).showToast();

  socket = new WebSocket("wss://cnc.f-ck.me/api/ws");

  socket.onopen = function () {
    Toastify({
      text: "Connected to Guya HQ!",
      duration: DEFAULT_TOAST_DURATION_MS,
    }).showToast();
    socket.send(JSON.stringify({ type: "getmap" }));
    socket.send(JSON.stringify({ type: "brand", brand: "userscriptV22" }));
  };

  socket.onmessage = async function (message) {
    var data;
    try {
      data = JSON.parse(message.data);
    } catch (e) {
      return;
    }

    switch (data.type.toLowerCase()) {
      case "map":
        Toastify({
          text: `Loading new map (reason: ${
            data.reason ? data.reason : "connecting to HQ"
          })...`,
          duration: DEFAULT_TOAST_DURATION_MS,
        }).showToast();
        currentOrderCtx = await getCanvasFromUrl(
          `https://cnc.f-ck.me/maps/${data.data}`,
          currentOrderCanvas,
          0,
          0,
          true
        );
        order = getRealWork(
          currentOrderCtx.getImageData(0, 0, 2000, 2000).data
        );
        Toastify({
          text: `New map loaded, ${order.length} pixels in total`,
          duration: DEFAULT_TOAST_DURATION_MS,
        }).showToast();
        break;
      case "toast":
        Toastify({
          text: `Message from Appu: ${data.message}`,
          duration: data.duration || DEFAULT_TOAST_DURATION_MS,
          style: data.style || {},
        }).showToast();
        break;
      default:
        break;
    }
  };

  socket.onclose = function (e) {
    Toastify({
      text: `Guya HQ has disconnected: ${e.reason}`,
      duration: DEFAULT_TOAST_DURATION_MS,
    }).showToast();
    console.error("Socketfout: ", e.reason);
    socket.close();
    setTimeout(connectSocket, 1000);
  };
}

async function attemptPlace() {
  if (order === undefined) {
    setTimeout(attemptPlace, 2000); // probeer opnieuw in 2sec.
    return;
  }

  // Timer check should happen before work is calculated
  const timer = await checkTimer();
  const timeoutCheck = await timer.json();

  const nextTimestamp =
    timeoutCheck.data.act.data[0].data.nextAvailablePixelTimestamp;

  if (nextTimestamp) {
    const nextPixel = nextTimestamp + 3000;
    const nextPixelDate = new Date(nextPixel);
    const delay = nextPixelDate.getTime() - Date.now();
    const toast_duration = delay > 0 ? delay : DEFAULT_TOAST_DURATION_MS;
    Toastify({
      text: `Your pixel isn't ready yet. Next pixel placed in ${nextPixelDate.toLocaleTimeString()}.`,
      duration: toast_duration,
    }).showToast();
    setTimeout(attemptPlace, delay);
    return;
  }

  var ctx;
  try {
    ctx = await getCanvasFromUrl(
      await getCurrentImageUrl("0"),
      currentPlaceCanvas,
      0,
      0,
      false
    );
    ctx = await getCanvasFromUrl(
      await getCurrentImageUrl("1"),
      currentPlaceCanvas,
      1000,
      0,
      false
    );
    ctx = await getCanvasFromUrl(
      await getCurrentImageUrl("2"),
      currentPlaceCanvas,
      0,
      1000,
      false
    );
    ctx = await getCanvasFromUrl(
      await getCurrentImageUrl("3"),
      currentPlaceCanvas,
      1000,
      1000,
      false
    );
  } catch (e) {
    console.warn("Error retrieving map: ", e);
    Toastify({
      text: "Error retrieving map. Retrying in 30 secs...",
      duration: DEFAULT_TOAST_DURATION_MS,
    }).showToast();
    setTimeout(attemptPlace, 10000); // probeer opnieuw in 10sec.
    return;
  }

  const rgbaOrder = currentOrderCtx.getImageData(0, 0, 2000, 2000).data;
  const rgbaCanvas = ctx.getImageData(0, 0, 2000, 2000).data;
  const work = getPendingWork(order, rgbaOrder, rgbaCanvas);

  if (work.length === 0) {
    Toastify({
      text: `All pixels are placed correctly, retrying in 30 seconds...`,
      duration: 30000,
    }).showToast();
    setTimeout(attemptPlace, 30000); // probeer opnieuw in 30sec.
    return;
  }

  const percentComplete = 100 - Math.ceil((work.length * 100) / order.length);
  const workRemaining = work.length;
  const idx = Math.floor(Math.random() * work.length);
  const i = work[idx];
  const x = i % 2000;
  const y = Math.floor(i / 2000);
  const hex = rgbaOrderToHex(i, rgbaOrder);

  Toastify({
    text: `Trying to place pixel on ${x}, ${y}... (${percentComplete}% complete, ${workRemaining} remaining)`,
    duration: DEFAULT_TOAST_DURATION_MS,
  }).showToast();

  const res = await place(x, y, COLOR_MAPPINGS[hex]);
  const data = await res.json();
  try {
    if (data.errors) {
      const error = data.errors[0];
      const nextPixel = error.extensions.nextAvailablePixelTs + 3000;
      const nextPixelDate = new Date(nextPixel);
      const delay = nextPixelDate.getTime() - Date.now();
      const toast_duration = delay > 0 ? delay : DEFAULT_TOAST_DURATION_MS;
      Toastify({
        text: `Pixel placed too fast! Next pixel placed in ${nextPixelDate.toLocaleTimeString()}.`,
        duration: toast_duration,
      }).showToast();
      setTimeout(attemptPlace, delay);
    } else {
      const nextPixel =
        data.data.act.data[0].data.nextAvailablePixelTimestamp +
        3000 +
        Math.floor(Math.random() * 4000);
      const nextPixelDate = new Date(nextPixel);
      const delay = nextPixelDate.getTime() - Date.now();
      const toast_duration = delay > 0 ? delay : DEFAULT_TOAST_DURATION_MS;
      Toastify({
        text: `Pixel placed on ${x}, ${y}! Next pixel placed in ${nextPixelDate.toLocaleTimeString()}.`,
        duration: toast_duration,
      }).showToast();
      setTimeout(attemptPlace, delay);
    }
  } catch (e) {
    console.warn("Error parsing response", e);
    Toastify({
      text: `Error parsing response: ${e}.`,
      duration: DEFAULT_TOAST_DURATION_MS * 12,
    }).showToast();
    setTimeout(attemptPlace, 10000);
  }
}

function checkTimer() {
  return fetch("https://gql-realtime-2.reddit.com/query", {
    method: "POST",
    body: JSON.stringify({
      query:
        'mutation GetPersonalizedTimer{\n  act(\n    input: {actionName: "r/replace:get_user_cooldown"}\n  ) {\n    data {\n      ... on BasicMessage {\n        id\n        data {\n          ... on GetUserCooldownResponseMessageData {\n            nextAvailablePixelTimestamp\n          }\n        }\n      }\n    }\n  }\n}\n\n\nsubscription SUBSCRIBE_TO_CONFIG_UPDATE {\n  subscribe(input: {channel: {teamOwner: AFD2022, category: CONFIG}}) {\n    id\n    ... on BasicMessage {\n      data {\n        ... on ConfigurationMessageData {\n          __typename\n          colorPalette {\n            colors {\n              hex\n              index\n            }\n          }\n          canvasConfigurations {\n            dx\n            dy\n            index\n          }\n          canvasWidth\n          canvasHeight\n        }\n      }\n    }\n  }\n}\n\n\nsubscription SUBSCRIBE_TO_CANVAS_UPDATE {\n  subscribe(\n    input: {channel: {teamOwner: AFD2022, category: CANVAS, tag: "0"}}\n  ) {\n    id\n    ... on BasicMessage {\n      id\n      data {\n        __typename\n        ... on DiffFrameMessageData {\n          currentTimestamp\n          previousTimestamp\n          name\n        }\n        ... on FullFrameMessageData {\n          __typename\n          name\n          timestamp\n        }\n      }\n    }\n  }\n}\n\n\n\n\nmutation SET_PIXEL {\n  act(\n    input: {actionName: "r/replace:set_pixel", PixelMessageData: {coordinate: { x: 53, y: 35}, colorIndex: 3, canvasIndex: 0}}\n  ) {\n    data {\n      ... on BasicMessage {\n        id\n        data {\n          ... on SetPixelResponseMessageData {\n            timestamp\n          }\n        }\n      }\n    }\n  }\n}\n\n\n\n\n# subscription configuration($input: SubscribeInput!) {\n#     subscribe(input: $input) {\n#       id\n#       ... on BasicMessage {\n#         data {\n#           __typename\n#           ... on RReplaceConfigurationMessageData {\n#             colorPalette {\n#               colors {\n#                 hex\n#                 index\n#               }\n#             }\n#             canvasConfigurations {\n#               index\n#               dx\n#               dy\n#             }\n#             canvasWidth\n#             canvasHeight\n#           }\n#         }\n#       }\n#     }\n#   }\n\n# subscription replace($input: SubscribeInput!) {\n#   subscribe(input: $input) {\n#     id\n#     ... on BasicMessage {\n#       data {\n#         __typename\n#         ... on RReplaceFullFrameMessageData {\n#           name\n#           timestamp\n#         }\n#         ... on RReplaceDiffFrameMessageData {\n#           name\n#           currentTimestamp\n#           previousTimestamp\n#         }\n#       }\n#     }\n#   }\n# }\n',
      variables: {
        input: {
          channel: {
            teamOwner: "GROWTH",
            category: "R_REPLACE",
            tag: "canvas:0:frames",
          },
        },
      },
      operationName: "GetPersonalizedTimer",
      id: null,
    }),
    headers: {
      origin: "https://hot-potato.reddit.com",
      referer: "https://hot-potato.reddit.com/",
      "apollographql-client-name": "mona-lisa",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

function place(x, y, color) {
  socket.send(JSON.stringify({ type: "placepixel", x, y, color }));
  return fetch("https://gql-realtime-2.reddit.com/query", {
    method: "POST",
    body: JSON.stringify({
      operationName: "setPixel",
      variables: {
        input: {
          actionName: "r/replace:set_pixel",
          PixelMessageData: {
            coordinate: {
              x: x % 1000,
              y: y % 1000,
            },
            colorIndex: color,
            canvasIndex: getCanvas(x, y),
          },
        },
      },
      query:
        "mutation setPixel($input: ActInput!) {\n  act(input: $input) {\n    data {\n      ... on BasicMessage {\n        id\n        data {\n          ... on GetUserCooldownResponseMessageData {\n            nextAvailablePixelTimestamp\n            __typename\n          }\n          ... on SetPixelResponseMessageData {\n            timestamp\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n",
    }),
    headers: {
      origin: "https://hot-potato.reddit.com",
      referer: "https://hot-potato.reddit.com/",
      "apollographql-client-name": "mona-lisa",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

function getCanvas(x, y) {
  if (x <= 999) {
    return y <= 999 ? 0 : 2;
  } else {
    return y <= 999 ? 1 : 3;
  }
}

async function getAccessToken() {
  const usingOldReddit = window.location.href.includes("new.reddit.com");
  const url = usingOldReddit
    ? "https://new.reddit.com/r/place/"
    : "https://www.reddit.com/r/place/";
  const response = await fetch(url);
  const responseText = await response.text();

  // TODO: ew
  return responseText.split('"accessToken":"')[1].split('"')[0];
}

async function getCurrentImageUrl(id = "0") {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      "wss://gql-realtime-2.reddit.com/query",
      "graphql-ws"
    );

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "connection_init",
          payload: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
      );
      ws.send(
        JSON.stringify({
          id: "1",
          type: "start",
          payload: {
            variables: {
              input: {
                channel: {
                  teamOwner: "AFD2022",
                  category: "CANVAS",
                  tag: id,
                },
              },
            },
            extensions: {},
            operationName: "replace",
            query:
              "subscription replace($input: SubscribeInput!) {\n  subscribe(input: $input) {\n    id\n    ... on BasicMessage {\n      data {\n        __typename\n        ... on FullFrameMessageData {\n          __typename\n          name\n          timestamp\n        }\n      }\n      __typename\n    }\n    __typename\n  }\n}",
          },
        })
      );
    };

    ws.onmessage = (message) => {
      const { data } = message;
      const parsed = JSON.parse(data);

      // TODO: ew
      if (
        !parsed.payload ||
        !parsed.payload.data ||
        !parsed.payload.data.subscribe ||
        !parsed.payload.data.subscribe.data
      )
        return;

      ws.close();
      resolve(
        parsed.payload.data.subscribe.data.name +
          `?noCache=${Date.now() * Math.random()}`
      );
    };

    ws.onerror = reject;
  });
}

function convertBase64(string) {
  return btoa(string).replace(/\+/g, "-").replace(/\//g, "_");
}

function getCanvasFromUrl(url, canvas, x = 0, y = 0, clearCanvas = false) {
  return new Promise((resolve, reject) => {
    let loadImage = (ctx) => {
      GM.xmlHttpRequest({
        method: "GET",
        url: url,
        responseType: "blob",
        onload: function (response) {
          var urlCreator = window.URL || window.webkitURL;
          var imageUrl = urlCreator.createObjectURL(this.response);
          var img = new Image();
          img.onload = () => {
            if (clearCanvas) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(img, x, y);
            resolve(ctx);
          };
          img.onerror = () => {
            Toastify({
              text: "Error retrieving map. Trying again in 3 sec...",
              duration: 3000,
            }).showToast();
            setTimeout(() => loadImage(ctx), 3000);
          };
          img.src = imageUrl;
        },
      });
    };
    loadImage(canvas.getContext("2d"));
  });
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
  );
}

let rgbaOrderToHex = (i, rgbaOrder) =>
  rgbToHex(rgbaOrder[i * 4], rgbaOrder[i * 4 + 1], rgbaOrder[i * 4 + 2]);
