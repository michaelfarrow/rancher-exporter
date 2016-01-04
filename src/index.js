
var Promise = require('promise');
var Prometheus = require("prom-client")
// var moment = require('moment');
var metadata = require('./metadata');
// var cattle = require('./cattle');
var express = require('express');
var request = require('request');
var http = require('http');
var _ = require('underscore');
var _s = require('underscore.string');

console.log('Starting exporter service');

var interval = process.env.UPDATE_INTERVAL || 20;
var updating = false;
// var forceUpdateInterval = process.env.FORCE_UPDATE_INTERVAL || 60;
// var envProvider = process.env.PROVIDER || 'digitalocean';
// var version = 'init';
// var lastUpdated = moment();
var healthCheckPort = 1000;

// var provider = require('./providers/' + envProvider);

var queueNextRun = function() {
	setTimeout(run, interval * 1000);
};

var parseData = function(res) {
	var hosts = res[0];
	var stacks = res[1];
	var services = res[2];
	var containers = res[3];

	_.each(stacks, function(stack){
		stack.services = _.filter(services, function(service){
			return _.contains(stack.services, service.name); 
		});

		_.each(stack.services, function(service){
			service.containers = _.filter(containers, function(container){
				return _.contains(service.containers, container.name);
			});

			_.each(service.containers, function(container){
				container.host = _.findWhere(hosts, {uuid: container.host_uuid});
			});
		});
	});

	return new Promise(function (resolve, reject) {
		resolve(stacks);
	});
};

var healthCheck = function(request, response) {
	var head = {'Content-Type': 'text/plain'};

	Promise.all([
		metadata.getStack()
	]).then(function() {
		response.writeHead(200, head);
		response.end('OK');
	}, function(error){
		response.writeHead(500, head);
		response.end('FAIL');
	});
}

var run = function() {
	Promise.all([
		metadata.getHosts(),
		metadata.getStacks(),
		metadata.getServices(),
		metadata.getContainers()
	])
		.then(parseData)
		.then(function(stacks){
			console.log('updating');
			updating = true;
			Prometheus.register.clear();

			var guage_stack_services = new Prometheus.gauge(
				'rancher_stack_services',
				'put description here',
				['name']
			);

			var total = 0;
			for(var i = 0; i < 999999999; i++){
				total += i;
			}

			setTimeout(function(){
			_.each(stacks, function(stack){
				guage_stack_services.set({name: stack.name}, stack.services.length);
			});
			updating = false;
			console.log('updated');
		}, 3000);
		})
		.catch(function(error){
			console.log(error);
		})
		.finally(queueNextRun);
}

var prom_server = express();
var hc_server = http.createServer(healthCheck);

hc_server.listen(healthCheckPort, function(){
    console.log("Healthcheck handler is listening on: %s", healthCheckPort);
});

prom_server.get('/metrics', function(req, res) {
	function wait(done){
		console.log('waiting', updating);
		if(updating){
			setTimeout(function(){
				wait(done);
			}, 100);
		}else{
			done();
		}
	}

	wait(function(){
		res.end(Prometheus.register.metrics());
	});
});

prom_server.listen(9110);

run();

