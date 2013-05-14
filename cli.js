#!/usr/bin/env node
var optimist = require('optimist'),
	fs = require('fs'),
	path = require('path'),
	net = require('net'),
	http = require('http'),
	url = require('url'),
	async = require('async');

/**
 * Get Network IP address
 * @param  {Function} Called when done, params: (err, ip)
 */
function getNetworkIP(callback) {
  var socket = net.createConnection(80, 'www.google.com');
  socket.on('connect', function() {
    callback(undefined, socket.address().address);
    socket.end();
  });
  socket.on('error', function(e) {
    callback(e);
  });
}

// Get IP & parse options
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

	// get NSS ready for running tests
	var nl = require('nss');
	process.setMaxListeners(0);
	nl.usePort(options.port);
	if (!options.log)
		nl.disableLogs();

	/**
	 * Check a cluster of machines
	 * @param  {Array}    checkHosts   Array of hosts to check
	 * @param  {Function} callback     Called when done, params: (runningHosts)
	 * @param  {Boolean}  runUntilTrue Keep polling until all hosts up?
	 */
	function checkCluster(checkHosts, callback, runUntilTrue){
		async.filter(checkHosts, function(host, inner_callback){
			console.log('checking', host);
			var req = http.request(url.parse('http://' + host), function(res){
				res.on('data', function (chunk) {});
				res.on('end', function () { inner_callback(true); });
			});
			req.on('error', function(error){ inner_callback(false); });
			req.end();
		}, function(runningHosts){
		    if (runUntilTrue){
		    	if (checkHosts.length == runningHosts.length){
		    		callback(runningHosts);
		    	}else{
		    		checkCluster(checkHosts, callback, runUntilTrue);
		    	}
		    }else{
		    	callback(runningHosts);
		    }
		    
		});
	}

	/**
	 * Spin up a test-cluster
	 * @param  {Object}   test     Test object
	 * @param  {Object}   options  Options object
	 * @param  {Function} callback Called when done, params: (cluster)
	 */
	function startCluster(test, options, callback){
		checkCluster(options.child, function(runningHosts){
			var cluster = new nl.LoadTestCluster(options.host + ':' + options.port, options.child);

			// setup exit strategy
			console.log("Test display running on http://" + options.host + ":" + options.port + "/ Ctrl-C to quit.");
			process.on('SIGINT', function () {
				console.log('\nGot SIGINT. Stopping test\n');
				cluster.end();
			});

			// run cluster
			cluster.run(test);

			callback(cluster);
		}, true);
	}

	// load test
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

	// am I a child or parent?
	if (test){
		// should I spin up AWS instances?
		if (options.instances > 0){
			var reservationId, instances;

			// handle timeout
			if (options.timeout !=0){
				// check to see that all the statuses are "running" after timeout
				setTimeout(function(){
					var completedInstances = instances.filter(function(instance){ return instance.instanceState.name == "running"; });
					if (completedInstances.length < instances.length ){
						console.error("AWS took more than " + options.timeout + " seconds to spin up the test machines. Aborting.");
						process.exit(1);
					}
				}, options.timeout * 1000);
			}

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
						console.log("AWS child running at " + instance.dnsName);
					});

					startCluster(test, options, function(cluster){
						cluster.on('end', function() {
							var toKill = {};
							instances.forEach(function(instance, i){
								toKill['InstanceId.' + (i+1)] = instance.instanceId;
							});
							console.log('killing', toKill);
							ec2("TerminateInstances", toKill, function(response){
								console.log('\nAll tests done. Killed AWS children, exiting.\n');
								process.exit(0);
							});
						});
					});					
				}else{
					setTimeout(describe, 2500);
				}
			}

			var script = new Buffer(fs.readFileSync(path.resolve("./child-script.sh"))).toString('base64');
			var ec2 = require("ec2")({key:options.key, secret:options.secret, endpoint:options.endpoint});
			ec2("RunInstances", { UserData: script, ImageId: options.machine, KeyName: options.authkey, MinCount: options.instances, MaxCount: options.instances, InstanceType:"t1.micro", SecurityGroup:options.group}, running);
		}else{
			// should I spin up a local tester for standalone
			if (options.child.length == 0){
				options.child.push(options.host + ':' + options.port);
			}
			// should I connect to a cluster to run my tests?
			if (options.child.length > 0){
				startCluster(test, options, function(cluster){
					console.log('\nAll tests done. exiting.\n');
					process.exit(0);
				});
			}
		}
	}else{
		console.log("running as child. Please add " + options.host + ":" + options.port + " to the children of a test-master.");
	}
});