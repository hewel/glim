(function () {
  // Device ID
  var deviceId = localStorage.getItem("glim.device_id");
  if (!deviceId) {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      deviceId = crypto.randomUUID();
    } else {
      deviceId = "device_" + Math.random().toString(36).slice(2);
    }
    localStorage.setItem("glim.device_id", deviceId);
  }

  // Display name
  var displayName = localStorage.getItem("glim.display_name") || "Glim Peer";
  var nameInput = document.getElementById("display-name");
  nameInput.value = displayName;

  var connectButton = document.getElementById("connect-button");
  var statusEl = document.getElementById("status");
  var peersEl = document.getElementById("peers");
  var logEl = document.getElementById("log");

  var ws = null;
  function findPeerItem(deviceId) {
    var items = peersEl.querySelectorAll("li");
    for (var i = 0; i < items.length; i += 1) {
      if (items[i].dataset.deviceId === deviceId) {
        return items[i];
      }
    }
    return null;
  }

  function renderPeer(peer) {
    var li = findPeerItem(peer.id);
    if (!li) {
      li = document.createElement("li");
      peersEl.appendChild(li);
    }
    li.dataset.deviceId = peer.id;
    li.textContent = peer.display_name + " (" + peer.id + ")";
  }

  function removePeer(deviceId) {
    var li = findPeerItem(deviceId);
    if (li) {
      li.remove();
    }
  }


  connectButton.addEventListener("click", function () {
    displayName = nameInput.value.trim() || "Glim Peer";
    localStorage.setItem("glim.display_name", displayName);

    if (ws) {
      ws.close();
    }

    var protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(protocol + "//" + location.host + "/ws");

    ws.addEventListener("open", function () {
      statusEl.textContent = "Connected";
      ws.send(
        JSON.stringify({
          type: "peer.hello",
          device_id: deviceId,
          display_name: displayName,
        })
      );
    });

    ws.addEventListener("message", function (event) {
      logEl.textContent += event.data + "\n";

      try {
        var data = JSON.parse(event.data);
        if (data.type === "peer.list") {
          peersEl.innerHTML = "";
          data.peers.forEach(renderPeer);
        } else if (data.type === "peer.joined") {
          renderPeer(data.peer);
        } else if (data.type === "peer.left") {
          removePeer(data.device_id);
        }
      } catch (e) {
        logEl.textContent += "Unable to parse server event\n";
      }
    });

    ws.addEventListener("close", function () {
      statusEl.textContent = "Disconnected";
    });

    ws.addEventListener("error", function () {
      statusEl.textContent = "Connection error";
    });
  });
})();
