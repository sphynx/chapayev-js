var players = require("../js/players.js");
var assert = require("assert");

assert.not = function(val, msg) {
    assert.ok(!val, msg);
};

// tests for 'add'
exports['add good'] = function() {
    var ps = players.Table();
    assert.equal(0, ps.size());

    ps.add(1, "a");
    ps.add(2, "b");
    ps.add(3, "c");
    assert.equal(3, ps.size());
};

exports['add nulls'] = function() {
    var ps = players.Table();

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
    var ps = players.Table();

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
    var ps = players.Table();

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
    var ps = players.Table();

    var res = ps.add(1, "a");
    assert.equal("a", res);

    res = ps.add(2, "a");
    assert.ok(res.length > 1); // has to fix the name somehow
};

// tests for 'update'
exports['update good'] = function() {
    var ps = players.Table();

    ps.add(1, "a");
    ps.update(1, "b");
    assert.equal("b", ps.get("1").nick);
};

exports['update null'] = function() {
    var ps = players.Table();

    ps.add(1, "a");
    ps.update(1, null); // should not update
    assert.equal("a", ps.get("1").nick);
};

exports['update non-existing'] = function() {
    var ps = players.Table();

    ps.update(1, "b"); // should create it
    assert.equal("b", ps.get("1").nick);

    ps.update(1, null); // should not update
    ps.update(null, null); // should not update

    assert.equal(1, ps.size());
};

// tests for 'remove'
exports['remove good'] = function() {
    var ps = players.Table();

    ps.add(1, "a");
    assert.equal(1, ps.size());
    ps.remove(1);
    assert.equal(0, ps.size());

    ps.add(1, "a");
    ps.add(2, "b");
    ps.add(3, "c");
    assert.equal(3, ps.size());
    ps.remove(1);
    ps.remove(2);
    ps.remove(3);
    assert.equal(0, ps.size());
};

exports['remove null'] = function() {
    var ps = players.Table();

    ps.add(1, "a");
    assert.equal(1, ps.size());
    ps.remove(null);
    ps.remove();
    assert.equal(1, ps.size());
};

exports['remove non-existing'] = function() {
    var ps = players.Table();
    ps.remove(123);
    assert.equal(0, ps.size());

    ps.add(1, "a");
    assert.equal(1, ps.size());

    ps.remove(1);
    ps.remove(1);
    ps.remove(2);
    ps.remove(2);
    assert.equal(0, ps.size());
};

// invite stuff
exports['invite_good'] = function() {
    var ps = players.Table();
    ps.add(1, 'a');
    ps.add(2, 'b');

    ps.invite(1, 2);
    assert.ok(ps.isInvited(1, 2));

    ps.decline(1, 2);
    assert.not(ps.isInvited(1, 2));
};

exports['invite_null'] = function() {
    var ps = players.Table();
    ps.add(1, 'a');

    ps.invite(1, null);

    // should be false, as we can't invite null guy
    assert.not(ps.isInvited(1, null));
};

exports['invite_unknown'] = function() {
    var ps = players.Table();
    ps.add(1, 'a');

    ps.invite(1, 2);

    // should be false, as there is no player with id = 2 in table
    assert.not(ps.isInvited(1, 2));
};

exports['invite_multiple'] = function() {
    var ps = players.Table();
    ps.add(1, 'a');
    ps.add(2, 'b');
    ps.add(3, 'c');

    ps.invite(1, 2);
    ps.invite(1, 2);
    ps.invite(1, 2);
    ps.invite(1, 3);
    assert.ok(ps.isInvited(1, 2));

    ps.decline(1, 2);
    ps.decline(1, 2);
    assert.not(ps.isInvited(1, 2));
    assert.ok(ps.isInvited(1, 3));

    ps.accept(1, 3);
    // accept removes from invite list as well
    assert.not(ps.isInvited(1, 3));
};

exports['invite_return_values'] = function() {
    var ps = players.Table();
    ps.add(1, 'a');
    ps.add(2, 'b');
    ps.add(3, 'c');

    assert.not(ps.invite(1, 1000), "can't invite unknown");
    assert.not(ps.invite(1, null), "can't invite null");
    assert.not(ps.invite(1, 1), "can't invite himself");

    ps.invite(1, 2);
    assert.ok(ps.invite(1, 2), "it's ok to invite twice");

    assert.not(ps.decline(100, 1), "can't decline unknown");
    assert.not(ps.decline(1, 100), "can't decline unknown");
    assert.not(ps.decline(1, null), "can't decline null");
    assert.not(ps.decline(null, null), "can't decline null");

    assert.not(ps.decline(2, 1), "cant' decline in wrong order");

    assert.ok(ps.decline(1, 2));
    assert.not(ps.decline(1, 2), "can't decline twice");

    ps.invite(1, 2);
    ps.invite(1, 2);
    assert.ok(ps.decline(1, 2));
    assert.not(ps.decline(1, 2), "can't decline twice even if invited twice");

    ps.invite(1, 2);
    ps.invite(1, 3);
    assert.ok(ps.accept(1, 2), "it's ok to accept an invite");
    assert.not(ps.accept(1, 2), "can't accept twice");
    assert.not(ps.isInvited(1, 2), "accepted are not inviting anymore");
    assert.not(ps.isInvited(1, 3), "accepted are not inviting anymore 2");
};

