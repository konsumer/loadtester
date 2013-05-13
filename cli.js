#!/usr/bin/env node
var optimist = require('optimist'),
	fs = require('fs'),
	path = require('path'),
	net = require('net');

// attempt to get your external network IP address
function getNetworkIP(callback) {
  var socket = net.createConnection(80, 'www.google.com');
  socket.on('connect', function() {
    callback(undefined, socket.address().address);
    socket.end();
  });
  socket.on('error', function(e) {
    callback(e, 'error');
  });
}

getNetworkIP(function(err, ip){
	var key, secret, endpoint;

	try{
		var o = JSON.parse(fs.readFileSync(path.resolve(process.env.HOME, ".aws"), "utf8"));
		key = o.key || '';
		secret = o.secret || '';
		endpoint = o.endpoint || '';
	}catch(e){}

	var options = optimist
		.usage('\nLoad test a webserver using a script\nUsage: $0 [testscript.js]')

		.alias('?', 'help')
			.describe('?', 'the help you are currently seeing')
			.check(function(argv){
				if (argv.help){
					optimist.showHelp(console.log);
					process.exit(0);
				}
			})
		
		.alias('c', 'child')
			.describe('c', 'host & port of children to use to test')

		.alias('p', 'port')
		    .describe('p', 'port to run on.')
		    .default('p', 3000)

		.alias('h', 'host')
		    .describe('h', 'an externally accessable hostname for this instance.')
		    .default('h', ip)

		.alias('i', 'instances')
		    .describe('i', 'The number of AWS instances to spin-up and send tests to')
		    .default('i', 0)

		.alias('a', 'authkey')
		    .describe('a', 'Your AWS instance keypair to use for --instances option')
		    .default('a', 'deploy')

		.alias('g', 'group')
		    .describe('g', 'The AWS security group that has port open for --instances option')
		    .default('g', 'loadtest')

		.alias('m', 'machine')
		    .describe('m', 'Your AWS AMI that has this script installed as a child for --instances option')
		    .default('m', 'ami-422ea672')

		.alias('k', 'key')
		    .describe('k', 'Your AWS auth key for --instances option')
		    .default('k', key)

		.alias('s', 'secret')
		    .describe('s', 'Your AWS secret for --instances option')
		    .default('s', secret)

		.alias('e', 'endpoint')
		    .describe('e', 'Your AWS endpoint zone for --instances option')
		    .default('e', endpoint)

		.alias('t', 'timeout')
		    .describe('t', 'Timeout for spinning up AWS machines --instances option')
		    .default('t', 120)

		.boolean('l')
			.alias('l', 'log')
		    .describe('l', 'create a HTML report log')

		.argv;

	if (options.child && typeof options.child == "string"){
		options.child = [options.child];
	}else{
		options.child = [];
	}

	// test is required, if there are children listed 
	if (options.child.length > 0){
		if (options['_'].length != 1){
			optimist.showHelp();
			console.error("must include exactly 1 test, if you list children!");
			process.exit(1);
		}
	}

	var test;

	if (options['_'].length == 1){
		try{
			test = require(path.resolve(options['_'][0]));
		}catch(e){
			optimist.showHelp();
			console.error("test is invalid: " + e);
			process.exit(1);
		}
	}

	// get NSS ready for running tests
	var nl = require('nss');
	process.setMaxListeners(0);
	nl.usePort(options.port);
	if (!options.log)
		nl.disableLogs()

	// handles actually starting a cluster, using options.child array as children
	function startCluster(callback){
		callback = callback || function(){ process.exit(0); };
		var cluster = new nl.LoadTestCluster(options.host + ':' + options.port, options.child);
		
		console.log("Test display running on http://" + options.host + ":" + options.port + "/ Ctrl-C to quit.");
		process.on('SIGINT', function () {
			console.log('\nGot SIGINT. Stopping test\n');
			cluster.end();
		});
		
		cluster.run(test);
		cluster.on('end', function() {
			console.log('\nAll tests done. exiting.\n');
			callback();
		});
	}

	// am I a slave, or a master?
	if (test){
		// should I spin up AWS instances?
		if (options.instances > 0){
			var reservationId, instances;

			if (options.timeout !=0){
				// check to see that all the statuses are "running" after timeout
				setTimeout(function(){
					var completedInstances = instances.filter(function(instance){
						return instance.instanceState.name == "running";
					});
					if (completedInstances.length < instances.length ){
						console.error("AWS took more than " + options.timeout + " seconds to spin up the test machines. Aborting.");
						process.exit(1);
					}
				}, options.timeout * 1000);
			}

			var script = new Buffer(fs.readFileSync(path.resolve("./child-script.sh"))).toString('base64');
			var ec2 = require("ec2")({key:options.key, secret:options.secret, endpoint:options.endpoint});
			ec2("RunInstances", { UserData: script, ImageId: options.machine, KeyName: options.authkey, MinCount: options.instances, MaxCount: options.instances, InstanceType:"t1.micro", SecurityGroup:options.group}, running);
			
			
			function describe() { ec2("DescribeInstances", {}, starting); }

			function running(error, response) {
				if (error) throw error;
				instances = response.instancesSet;
				console.log("AWS instances spinning up. Please wait.");
				reservationId = response.reservationId
				describe();
			}

			function starting(error, response) {
				if (error) throw error;
				var reservation = response.reservationSet.filter(function (reservation) {
					return reservation.reservationId == reservationId;
				})[0];

				var runningInstances = reservation.instancesSet.filter(function (instance) {
					return instance.instanceState.name == "running";
				});

				if (runningInstances.length == instances.length){
					instances = runningInstances;
					instances.forEach(function(instance){
						var h = instance.dnsName + ':' + options.port;
						options.child.push(h);
						console.log("loadtester running on " + h);
					});
					startCluster(function(){
						console.log("Stopping AWS cluster.");
						var cluster = {};
						// delete all AWS machines
						instances.forEach(function(instance,i){
							cluster['InstanceId.' + (i+1)] = instance.instanceId;
						});
						ec2("TerminateInstances", cluster, function(error, response){
							if (error) throw error;
							process.exit(0);
						});
					});
				}else{
					setTimeout(describe, 2500);
				}
			}
		}else{
			// should I spin up a local tester for standalone
			if (options.child.length == 0){
				options.child.push(options.host + ':' + options.port);
			}
			// should I connect to a cluster to run my tests?
			if (options.child.length > 0){
				startCluster();
			}
		}
	}else{
		console.log("running as child. Please add " + options.host + ":" + options.port + " to the children of a test-master.");
	}
});