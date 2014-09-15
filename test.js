var assert = require("assert");
var nock = require('nock');
var testConfig = require('./testConfig');

nock('https://netflix.pagerduty.com')
  .get('/api/v1/users?include%5B%5D=notification_rules&include%5B%5D=contact_methods&limit=100&offset=0')
  .reply(200, {"users":[{"id":"don't","name":"care"}],"limit":1,"offset":0,"total": 2})
  .get('/api/v1/users?include%5B%5D=notification_rules&include%5B%5D=contact_methods&limit=100&offset=1')
  .reply(200, {"users":[testConfig.pagerduty.user],"limit":1,"offset":1,"total": 2});

nock('https://netflix.pagerduty.com')
  .get('/api/v1/escalation_policies/on_call?limit=100&offset=0')
  .reply(200, {"escalation_policies":[{"id":"don't","name":"care"}],"limit":1,"offset":0,"total":2})
  .get('/api/v1/escalation_policies/on_call?limit=100&offset=1')
  .reply(200, {"escalation_policies":[testConfig.pagerduty.policy],"limit":1,"offset":1,"total":2});

var PagerDuty = require("./index");

describe('PagerDuty', function(){
  this.timeout(35000);
  var pagerDuty = new PagerDuty(testConfig.pagerduty.auth);

  it('should contain a map of users', function(done){
    var user = testConfig.pagerduty.user;
    pagerDuty.getUsers(function (error, users) {
      assert.equal(user.name, users[user.id].name);
      done();
    });
  });

  it('should contain a map of policies', function(done){
    var policy = testConfig.pagerduty.policy;
    pagerDuty.getEscalationPolicies(function (error, policies) {
      assert.equal(policy.name, policies[policy.id].name);
      done();
    });
  });
});