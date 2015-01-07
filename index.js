/*jslint node: true */
/*globals module: true */
"use strict";

var request = require('request');
var _ = require('underscore');
var querystring = require('querystring');
var debug = require('debug')('pagerduty-netflix');

var headers;

/**
 * params object:
 *   domain: String (required)
 *   token: String (required)
 *   
**/
var PagerDuty = function (options) {
  this.headers = {'Content-Type': 'application/json', 'Authorization': 'Token token=' + options.token};
  this.endpoint = "https://" + options.domain + ".pagerduty.com/api/v1";
  this.cache = new Cache(this);
};


PagerDuty.prototype.getAllPaginatedData = function (options) {
  options.params = options.params || {};
  options.params.limit = 100; // 100 is the max limit allowed by pagerduty
  options.params.offset = 0;

  var total = null,
      items = [],
      items_map = {},
      self = this,
      requestOptions = {
        headers: this.headers,
        json: true
      };

  var pagedCallback = function (error, content) {
    if (error) {
      debug("Issues with pagedCallback: " + error);
      return options.callback(error);
    }

    if (!content || !content.hasOwnProperty(options.contentIndex)) {
      error = "Page does not have valid data: " + JSON.stringify(content);
      debug(error);
      return options.callback(new Error(error));
    }

    if (content[options.contentIndex].length > 0) {
      items = items.concat(content[options.contentIndex]);
    }

    options.params.offset = content.offset + content.limit; // Update the offset for the next paging request
    total = content.total;

    // Index the results as a map from id: item
    _.each(items, function(item) {
      items_map[item.id] = item;
    });

    if (options.params.offset >= total) {
      return options.callback(error, items_map);
    } else {
      requestAnotherPage();
    }
  };

  var requestAnotherPage = function () {
    // must use node's built in querystring since qs doesn't build arrays like PagerDuty expects.
    requestOptions.url = self.endpoint + options.uri + "?" + querystring.stringify(options.params);

    request(requestOptions, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        pagedCallback(null, body);
      } else {
        pagedCallback(error);
      }
    });
  };

  requestAnotherPage();
};

PagerDuty.prototype.getEscalationPolicies = function (callback) {
  this.getAllPaginatedData( {contentIndex: "escalation_policies", uri: "/escalation_policies/on_call", callback: callback} );
};

PagerDuty.prototype.getUsers = function (callback) {
  this.getAllPaginatedData( {contentIndex: "users", uri: "/users", params: {"include[]":["notification_rules", "contact_methods"]}, callback: callback} );
};

PagerDuty.prototype.getSchedules = function (callback) {
  this.getAllPaginatedData( {contentIndex: "schedules", uri: "/schedules", callback: callback} );
};

var Cache = function (pagerduty) {
  this.pagerduty = pagerduty;
};

Cache.prototype = {
  workerInterval: 60000,
  users: {},
  policies: {},
  schedules: {},
  getUsers: function () { return this.users; },
  getPolicies: function () { return this.policies; },
  getSchedules: function () { return this.schedules; },
  fetchUsers: function () {
    var self = this;
    this.pagerduty.getUsers(function (err, returnedUsers) {
      setTimeout(self.fetchUsers.bind(self), self.workerInterval);
      if (err) {
        debug("Error refreshing PagerDuty users: %s", err.message);
        throw (err);
      }
      self.users = returnedUsers;
      debug("Refreshed PagerDuty users");
    });
  },
  fetchEscalationPolicies: function () {
    var self = this;
    this.pagerduty.getEscalationPolicies(function (err, returnedPolicies) {
      setTimeout(self.fetchEscalationPolicies.bind(self), self.workerInterval);
      if (err) {
        debug("Error refreshing PagerDuty escalation policies: %s", err.message);
        throw (err);
      }
      self.policies = returnedPolicies;
      debug("Refreshed PagerDuty escalation policies");
    });
  },
  fetchSchedules: function () {
    var self = this;
    this.pagerduty.getSchedules(function (err, returnedSchedules) {
      setTimeout(self.fetchSchedules.bind(self), self.workerInterval);
      if (err) {
        debug("Error refreshing PagerDuty schedules: %s", err.message);
        throw(err);
      }
      self.schedules = returnedSchedules;
      debug("Refreshed PagerDuty schedules");
    })
  },
  start: function (workerInterval) {
    this.workerInterval = workerInterval || this.workerInterval;
    this.fetchUsers();
    this.fetchEscalationPolicies();
    this.fetchSchedules();
  }
};

module.exports = PagerDuty;