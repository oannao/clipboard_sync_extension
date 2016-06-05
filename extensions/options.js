$(document).ready(function() {

  $("#save-options").click(function(event){
    $("#warn").css("display", "none");
    $("#info").css("display", "none");
    chrome.storage.sync.get("oldKey", function(obj){
      oldKey = obj.oldKey;
      if (oldKey === ""){
        saveOptions();
        $("#info").css("display", "block");
      } else {
        $("#warn").css("display", "block");
      }
    });
  });

  function saveOptions() {
    chrome.storage.sync.get("key", function(obj){
      if (obj.key) {
        chrome.storage.sync.set({"oldKey": obj.key});
      }
    });
    chrome.storage.sync.set({"key": $("#key").val()});
  }

  function restoreOptions() {
    chrome.storage.sync.get("key", function(obj){
      if (obj.key) {
        $("#key").val(obj.key);
      }
    });
  }
  restoreOptions();
});