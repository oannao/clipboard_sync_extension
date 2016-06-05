var alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 
                'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
                'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D',
                'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N',
                'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X',
                'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7', 
                '8', '9'];

// Listen a message from contentscript.
chrome.extension.onRequest.addListener(
  function(request, sender, sendResponse) {
    if (request.removeOldKey) {
      chrome.storage.sync.set({"oldKey": ""});
    } else if (request.writeClipboard) {
        writeClipboard(request.data);
    } else if (request.readClipboard) {
      var clipboard = readClipboard();
      sendResponse({clipboard: clipboard});
    } else if (request.reloadPage) {
      chrome.tabs.reload();
    } else if (request.getKey) {
      chrome.storage.sync.get(['key','oldKey'], function (item){
        sendResponse({key: item.key, oldKey: item.oldKey});
      });
    } else if (request.removeOldKey) {
      chrome.storage.sync.set({"oldKey": ""});
    } else {
      console.error('Unknown request', request);
    }
  }
);

chrome.storage.sync.get("key", function(obj){
  if (!obj.key) {
    var randomKey = "";
    for (var i = 0; i < 16; i++) {
      var num = Math.floor(Math.random() * alphabet.length);
      randomKey += alphabet[num];
    }
    chrome.storage.sync.set({"key": randomKey});
    chrome.storage.sync.set({"oldKey": ""});
    return;
  }
});

function writeClipboard(data) {
  var textArea = $('<textarea/>').css('position', 'absolute').css('left', '-100%').val(data);
  $(document.body).append(textArea);
  textArea.select().focus();
  document.execCommand("copy");
  textArea.remove();

  notification = createNotificationInstance(data);
  notification.show();
}

function readClipboard() {
   var textArea = $('<textarea/>').css('position', 'absolute').css('left', '-100%');
   $(document.body).append(textArea);
   textArea.select().focus();
   document.execCommand('paste');
   var clipboard = textArea.val();
   textArea.remove();
   return clipboard;
}

function createNotificationInstance(text){
    return window.webkitNotifications.createNotification(
        '', 'Change!', text);
}

var APPENGINE_URL = "https://kktn-anna.appspot.com/";

chrome.browserAction.onClicked.addListener(function(tab) {
  chrome.tabs.query({}, function(tabs) {
    for (var i = 0; i < tabs.length; ++i) {
      if (tabs[i].url.match(APPENGINE_URL)) {
        chrome.tabs.update(tabs[i].id, {active: true});
        return;
      }
    }
    chrome.tabs.create({url: APPENGINE_URL});
  });
});