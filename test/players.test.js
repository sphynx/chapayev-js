require("../js/players.js");
var assert = require("assert");

// add

exports['add good'] = function() {
    var ps = CH_PlayersTable();
    assert.equal(0, ps.size());

    ps.add(1, "a");
    ps.add(2, "b");
    ps.add(3, "c");
    assert.equal(3, ps.size());
};

exports['add nulls'] = function() {
    var ps = CH_PlayersTable();

    ps.add(1, null);
    assert.equal(0, ps.size());

    ps.add(1, undefined);
    assert.equal(0, ps.size());

    ps.add(null, "a");
    assert.equal(0, ps.size());

    ps.add(undefined, "a");
    assert.equal(0, ps.size());
};

exports['add non unique'] = function() {
    var ps = CH_PlayersTable();

    ps.add(1, "a");
    ps.add(1, "b"); // should overwrite
    assert.equal(1, ps.size());
    assert.equal(ps.ids().length, ps.nicks().length);

    ps.add(1, "a");
    ps.add(2, "a"); // should fix the nick
    assert.equal(2, ps.size());
    assert.equal(ps.ids().length, ps.nicks().length);
};

exports['add non unique'] = function() {
    var ps = CH_PlayersTable();

    ps.add(1, "a");
    ps.add(1, "b"); // should overwrite
    assert.equal(1, ps.size());
    assert.equal(ps.ids().length, ps.nicks().length);
    
    ps.add(1, "a");
    ps.add(2, "a"); // should fix the nick
    assert.equal(2, ps.size());
    assert.equal(ps.ids().length, ps.nicks().length);
};

exports['add returns'] = function() {
    var ps = CH_PlayersTable();

    var res = ps.add(1, "a");
    assert.equal("a", res);
    
    res = ps.add(2, "a");
    assert.ok(res.length > 1); // has to fix the name somehow
};

// update
exports['update good'] = function() {
    var ps = CH_PlayersTable();

    ps.add(1, "a");
    ps.update(1, "b");
    assert.equal("b", ps.get("1").nick);
};

exports['update null'] = function() {
    var ps = CH_PlayersTable();

    ps.add(1, "a");
    ps.update(1, null); // should not update
    assert.equal("a", ps.get("1").nick);
};

exports['update non-existing'] = function() {
    var ps = CH_PlayersTable();

    ps.update(1, "b"); // should create it
    assert.equal("b", ps.get("1").nick);
};

