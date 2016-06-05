var oldClipboard;

// Listen a message from page.
window.addEventListener("message", function(event) {
  if (event.source != window)
    return;
  if (event.data.type && (event.data.type == "FROM_PAGE")) {
    onMessageFromPage(event.data);
  }
}, false);

function onMessageFromPage(message) {
  // Send the message to background page.
  if (message.getKey) {
    chrome.extension.sendRequest(message, function(response){
      sendMessageToPage(response);
    });
  } else if (oldClipboard == undefined){
    chrome.extension.sendRequest(message, function(response) {
      oldClipboard = response.clipboard;
    });
  } else if (message.readClipboard) {
    chrome.extension.sendRequest(message, function(response) {
      if (response.clipboard) {
        if (response.clipboard != oldClipboard) {
          clipboardReceived(response.clipboard);
        }
        oldClipboard = response.clipboard;
      }
    });
  } else if (message.writeClipboard) {
    if (oldClipboard != message.data) {
      oldClipboard = message.data;
      chrome.extension.sendRequest(message, function(response) {});
    }
  } else if (message.reloadPage) {
    chrome.extension.sendRequest(message, function(response) {});
  } else if (message.removeOldKey) {
    chrome.extension.sendRequest(message, function(response) {});
  } else{
    console.error("unknown message!");
  }
}

function sendMessageToPage(message) {
  message.type = "FROM_CONTENTSCRIPT";
  window.postMessage(message, "*");
}

function clipboardReceived(clipboard) {
  sendMessageToPage({clipboard: clipboard});
}