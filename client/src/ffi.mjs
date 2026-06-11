let socket = null;

export function loadIdentity() {
  let deviceId = localStorage.getItem("glim.device_id");
  if (!deviceId) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      deviceId = crypto.randomUUID();
    } else {
      deviceId = "device_" + Math.random().toString(36).slice(2);
    }
    localStorage.setItem("glim.device_id", deviceId);
  }

  return {
    device_id: deviceId,
    display_name: localStorage.getItem("glim.display_name") || "Glim Peer",
  };
}

export function connect(displayName, helloJson, onOpen, onClose, onError, onMessage) {
  localStorage.setItem("glim.display_name", displayName);

  if (socket) {
    socket.close();
  }

  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(protocol + "//" + location.host + "/ws");

  socket.addEventListener("open", function () {
    socket.send(helloJson);
    onOpen();
  });

  socket.addEventListener("message", function (event) {
    if (typeof event.data === "string") {
      onMessage(event.data);
    }
  });

  socket.addEventListener("close", function () {
    onClose();
  });

  socket.addEventListener("error", function () {
    onError();
  });
}

export function send(payload, onError) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(payload);
  } else {
    onError();
  }
}

export function formatTime(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

