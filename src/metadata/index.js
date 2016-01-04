
var request = require('request');
var Promise = require('promise');
var _ = require('underscore');

var metadata = function(){
	
};

metadata.prototype = {

	makeRequest: function(url) {
		if(_.isArray(url))
			url = url.join('/');

		var req = {
			url: 'http://rancher-metadata/latest/' + url,
			headers: {
				'Accept': 'application/json'
			}
		};

		return new Promise(function (resolve, reject) {
			request(req, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					resolve(JSON.parse(body));
				} else {
					reject('Metadata - ' + error);
				}
			});
		});
	},

	getVersion: function() {
		return this.makeRequest('version');
	},

	getHosts: function() {
		return this.makeRequest('hosts');
	},

	getContainers: function(i) {
		return this.makeRequest('containers');
	},

	getStacks: function() {
		return this.makeRequest('stacks');
	},

	getServices: function() {
		return this.makeRequest('services');
	},

	getStack: function() {
		return this.makeRequest('self/stack');
	}

}

module.exports = new metadata();
