var DS_utils = window["DS_utils"] = {};

// util function for easy formatting
String.prototype.format = function() {
    var formatted = this;
    for (arg in arguments) {
        formatted = formatted.replace("{" + arg + "}", arguments[arg]);
    }
    return formatted;
};

DS_utils.isEmpty = function(obj) {
    for (var i in obj) { return false; }
    return true;
};

// Logs message `msg`.
// also additional parameters might be passed filling {0}, {1}, etc. in `msg`
//
// Examples:
// log("hello")  --> prints "hello"
// log("hello {0}, it's {1}", "vasya", "petya")  --> prints "hello vasya, it's petya"
//
DS_utils.log = function(msg) {

    // convert arguments to real array
    var args = Array.prototype.slice.call(arguments);

    // remove first argument (msg)
    args.splice(0, 1);

    // format string if there is additional parameters
    if (args.length > 0) {
        msg = String.prototype.format.apply(msg, args);
    }

    // log using console if it's defined
    if (typeof console !== "undefined") {
        console.log(msg);
    } else {
        // alert otherwise
        alert(msg);
    }
};
