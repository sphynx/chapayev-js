var DS_utils = window["DS_utils"] = {};

// util function for easy formatting
String.prototype.format = function() {
    var formatted = this;
    for (var i = 0; i < arguments.length; i++) {
        formatted = formatted.replace("{" + i + "}", arguments[i]);
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

// cookie functions are based on PPK code from here:
// http://www.quirksmode.org/js/cookies.html
DS_utils.createCookie = function(name, value, days) {
    var expires;
	if (days) {
		var date = new Date();
		date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
		expires = "; expires=" + date.toGMTString();
	} else {
        expires = "";
    }

	document.cookie = name + "=" + value + expires + "; path=/";
};

DS_utils.readCookie = function(name) {
	var nameEQ = name + "=";
	var ca = document.cookie.split(';');
	for(var i = 0; i < ca.length; i++) {
		var c = ca[i];
		while (c.charAt(0) === ' ') {
            c = c.substring(1, c.length);
        }
		if (c.indexOf(nameEQ) === 0) {
            return c.substring(nameEQ.length, c.length);
        }
	}
	return null;
};

DS_utils.deleteCookie = function(name) {
	createCookie(name, "", -1);
};
