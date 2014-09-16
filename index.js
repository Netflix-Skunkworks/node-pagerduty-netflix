/*jslint node: true */
/*globals module: true */
"use strict";

var request = require('request');
var _ = require('underscore');
var querystring = require('querystring');

var headers,
    users;

/**
 * params object:
 *   domain: String (required)
 *   token: String (required)
 *   
**/
var PagerDuty = function (options) {
  this.headers = {'Content-Type': 'application/json', 'Authorization': 'Token token=' + options.token};
  this.endpoint = "https://" + options.domain + ".pagerduty.com/api/v1";
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
    items = items.concat(content[options.contentIndex]);

    options.params.offset = content.offset + content.limit; // Update the offset for the next paging request
    total = content.total;

    // Index the results as a map from id: item
    _.each(items, function(item) {
      items_map[item.id] = item;
    });

    if (options.params.offset >= total) {
      options.callback(error, items_map);
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

module.exports = PagerDuty;