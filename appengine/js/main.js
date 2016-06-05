$(document).ready(function() {

  var token = $('#channel-token').html();
  var socket;
  var readTimer = window.setInterval(readClipboard, 1000);
  var clipboardLimit = 10;
  var allClipboard;
  var key;
  var oldKey;

  function openChannel(token) {
    var channel = new goog.appengine.Channel(token);
    socket = channel.open();
    socket.onmessage = messageReceived;
    socket.onerror = socketError;
    socket.onclose = socketError;
  }

  function socketError(error){
    $.ajax({url: "/rpc.getChannelToken",
      contentType: "application/json",
      type: "POST",
      data: "{}",
      dataType: "json"
    }).done(function(data) {
      openChannel(data.channel_token);
    });
  }

  function messageReceived(message) {
    var messageData = JSON.parse(message.data);
    if (messageData['type'] == 'reload'){
      reloadPage();
    } else if(messageData['type'] == 'clipboard'){
      messageData['body'] = decrypt(messageData['body']);
      writeClipboard(messageData['body']);
    }
    getClipboardsHistory();
  }

  function encrypt(message){
    var body = CryptoJS.AES.encrypt(message, key).toString();
    return body;
  }

  function decrypt(message){
    var body = CryptoJS.AES.decrypt(message, key).toString(CryptoJS.enc.Utf8);
    return body;
  }

  function decryptByOldKeyAndEncryptByNewKey(data){
    data.history = data.history || [];
      for (var i = 0; i < data.history.length; ++i) {
        data.history[i].body = encrypt(oldKeyDecrypt(data.history[i].body));
      }
      $.ajax({url: "/rpc.sendClipboardsHistory",
              dataType: "json",
              contentType: "application/json",
              type: "POST",
              data: JSON.stringify({clipboard_history: data})
            });
      window.postMessage({ type: "FROM_PAGE",
                           removeOldKey: true },"*");
  }

  function oldKeyDecrypt(message){
    return CryptoJS.AES.decrypt(message, oldKey).toString(CryptoJS.enc.Utf8);
  }

  function sendClipboard(body) {
    to = $("#user-id").text();
    if (to == "guest") {
      return;
    }

    var date = new Date();
    var minutes = String(date.getMinutes());
    if (minutes.length == 1) {
      minutes = "0" + minutes;
    }

    $.ajax({url: "/rpc.sendClipboard",
      dataType: "json",
      contentType: "application/json",
      type: "POST",
      data: JSON.stringify({
        body: encrypt(body),
        month: String(date.getMonth() + 1),
        day: String(date.getDate()),
        hours: String(date.getHours()),
        minutes: minutes,
        sha1: CryptoJS.SHA1(body).toString()
      })
    });
  }

  function getClipboardsHistory() {
    /* Send the data using post and put the results in a div */
    $.ajax({url: "/rpc.getClipboards",
      contentType: "application/json",
      type: "POST",
      data: "{}",
      dataType: "json"
    }).done(function(data) {
      data.history = data.history || [];
      for (var i = 0; i < data.history.length; ++i) {
        data.history[i].body = decrypt(data.history[i].body);
      }
      allClipboard = data.history;
      showClipboards(data.history);
    });
  }

  function searchClipboards(searchWord) {
    var results = [];
    var data = allClipboard;
    var word = searchWord.split(RegExp(" +"));
    for (var i = 0; i < data.length; ++i) {
      for(var j = 0; j < word.length; ++j) {
        if (data[i].body.indexOf(word[j]) == -1) {
          break;
        } else if (j == word.length - 1) {
          results.push(data[i]); 
        }
      }
    }  
    showClipboards(results);
  }

  function showClipboards(data){
    var cnt = 0;
    $("#clip-timeline").empty();
    function addresult(message) {
      $("#clip-timeline").prepend(
        "<tr><td class=\"clip-content\" id=\"content-" + cnt + "\"></td><td>" + 
        message.month + "/" + message.day + 
        "</td><td>" + message.hours + ":" + message.minutes + "</td><td><button class=\"btn btn-info btn-small copy\" id=\"" + cnt + "\">Copy</button></td>" + 
        "<td><button class=\"btn btn-small remove-clipboard\" id=\"remove-clipboard" + cnt + "\" value=\""+ cnt + "\"><i class=\"icon-trash\"></i></button></td></tr>");
      $("#content-" + cnt).text(message.body);
      cnt++;
    }
    data.slice(-clipboardLimit).forEach(addresult);
      $('.copy').click(function(event) {
        event.preventDefault();
        var content = $("#content-" + this.id).text();
        writeClipboard(content);
        sendClipboard(content);
        $('#search-word').val("");
        return false;
      });
      $('.remove-clipboard').click(function(event){
        event.preventDefault();
        var id = $(this).val();
        var body = $("#content-" + id).text();
        var sha1 = CryptoJS.SHA1(body).toString();
        body = encrypt(body);
        $.ajax({url: "/rpc.removeClipboard",
          dataType: "json",
          contentType: "application/json",
          type: "POST",
          data: JSON.stringify({
            sha1: sha1
          })
        }).done(function(data) {
          data.history = data.history || [];
          for (var i = 0; i < data.history.length; ++i) {
            data.history[i].body = decrypt(data.history[i].body);
          }
          allClipboard = data.history;
          var searchWord = $('#search-word').val();
          if (searchWord === '') {
            showClipboards(allClipboard);
          } else {
            searchClipboards(searchWord);
          }
        });
        return false;
      });
  }

  function writeClipboard(clipboard) {
    window.postMessage({ type: "FROM_PAGE",
     writeClipboard: true,
     data: clipboard},
     "*");
  }

  function readClipboard() {
    window.postMessage({ type: "FROM_PAGE",
     readClipboard: true },
     "*");
  }

  function reloadPage() {
    window.postMessage({ type: "FROM_PAGE",
     reloadPage: true },
     "*");
  }

  $('#flush-all').click(function(event){
    event.preventDefault();
    $.ajax({url: "/flush_all",
      dataType: "json"
    }).done(function(data) {
      $("#timeline").empty();
      $("#clip-timeline").empty();
    });
    return false;
  });

  $('#channel').click(function(event){
    event.preventDefault();
    $.ajax({url: "/rpc.getChannelToken",
      contentType: "application/json",
      type: "POST",
      data: "{}",
      dataType: "json"
    }).done(function(data) {
      channel = new goog.appengine.Channel(data.channel_token);
      socket = channel.open();
      socket.onmessage = messageReceived;
    });
    return false;
  });

  $('#line').change(function(event){
    var lineNumber = $(this).val();
    clipboardLimit = lineNumber;
    showClipboards(allClipboard);
  });

  $('#search-word').keyup(function(event){
    var searchWord = $(this).val();
    searchClipboards(searchWord);
  });

  // Listen a message from contentscript.
  window.addEventListener("message", function(event) {
    if (event.source != window)
      return;
    if (event.data.type && (event.data.type == "FROM_CONTENTSCRIPT")) {
      if (event.data.clipboard) {
        sendClipboard(event.data.clipboard);
      } else if (event.data.key) {
        key = event.data.key;
        oldKey = event.data.oldKey;
        if (oldKey !== "") {
          $.ajax({url: "/rpc.getClipboards",
            contentType: "application/json",
            type: "POST",
            data: "{}",
            dataType: "json"
            }).done(function(data) {
              decryptByOldKeyAndEncryptByNewKey(data);
              getClipboardsHistory();
            });
        } else {
          getClipboardsHistory();
        }
      }
    }
  }, false);

  window.postMessage({ type: "FROM_PAGE",
     getKey: true },
     "*");
  openChannel(token);
});
