var DS_utils = window["DS_utils"] = {};

DS_utils.isEmpty = function(obj) {
    for (var i in obj) { return false; }
    return true;
};

DS_utils.log = function(msg) {
    if (typeof console !== "undefined") {
        console.log(msg);
    } else {
        alert(msg);
    }
};
