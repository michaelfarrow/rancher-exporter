
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
			updating = true;
			Prometheus.register.clear();

			var guage_stack_services = new Prometheus.gauge(
				'rancher_stack_services',
				'Number of services running',
				['environment', 'name']
			);

			var guage_service_containers = new Prometheus.gauge(
				'rancher_service_containers',
				'Number of containers running (scale)',
				['environment', 'name', 'stack']
			);

			var guage_container_health = new Prometheus.gauge(
				'rancher_container_health',
				'Health of container, 0 = Unhealthy, 1 = No healthcheck or healthy',
				['environment', 'host_name', 'host_ip', 'host_uuid', 'name', 'service', 'stack']
			);

			try{
				_.each(stacks, function(stack){
					var env = stack.environment_name.toLowerCase();

					guage_stack_services.set({
						environment: env,
						name: stack.name
					},stack.services.length);

					_.each(stack.services, function(service){
						guage_service_containers.set({
							environment: env,
							name: service.name,
							stack: stack.name
						}, service.containers.length);

						_.each(service.containers, function(container){
							guage_container_health.set({
								environment: env,
								host_uuid: _.isNull(container.host) ? '' : container.host.uuid,
								host_ip: _.isNull(container.host) ? '' : container.host.agent_ip,
								host_name: _.isNull(container.host) ? '' : container.host.name,
								name: container.name,
								service: service.name,
								stack: stack.name
							}, _.isNull(container.health_state) || container.health_state == 'healthy' ? 1 : 0);
						});
					});
				});
			}catch(error){
				updating = false;
				throw(error);
			}
			updating = false;
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

prom_server.get('/', function(req, res){
	res.end(`
		<html>
		<head><title>Rancher Exporter</title></head>
		<body>
		<h1>Rancher Exporter</h1>
		<p><a href="/metrics">Metrics</a></p>
		</body>
		</html>
	`);
});

prom_server.get('/metrics', function(req, res) {
	function wait(done){
		if(updating){
			console.log('waiting');
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

