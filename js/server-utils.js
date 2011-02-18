// util function for easy formatting
String.prototype.format = function() {
    var formatted = this;
    for (var i = 0; i < arguments.length; i++) {
        formatted = formatted.replace("{" + i + "}", arguments[i]);
    }
    return formatted;
};

exports.log = function(msg) {
    // convert arguments to real array, dropping first argument
    var args = Array.prototype.slice.call(arguments, 1);

    // format string if there is additional parameters
    if (args.length > 0) {
        msg = String.prototype.format.apply(msg, args);
    }

    console.log(msg);
};
