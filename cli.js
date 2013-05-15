#!/usr/bin/env node
var optimist = require('optimist'),
    fs = require('fs'),
    path = require('path'),
    net = require('net');

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
            .describe('m', 'Your AWS AMI that will run this script for --instances option')
            .default('m', 'ami-bf1d8a8f')

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
            .describe('t', 'Timeout (in seconds) for spinning up AWS machines --instances option')
            .default('t', 120)

        .alias('u', 'update')
            .describe('u', 'Update frequency (in seconds) for polling children')
            .default('u', 2)

        .describe('comment', 'Comment for log/HTML output')

        .boolean('l')
            .alias('l', 'log')
            .describe('l', 'create a local HTML report log')

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

    // load test
    if (options['_'].length == 1){
        try{
            options.test = require('./' + options['_'][0]);
        }catch(e){
            optimist.showHelp();
            console.error("test is invalid: " + e);
            process.exit(1);
        }
    }

    var loadtester = require('./lib.js')(options);

    // am I a child or parent?
    if (options.test){
        // should I spin up AWS instances?
        if (options.instances > 0){
            options.script = path.join(__dirname, "child-script.sh");
            loadtester.aws_spinup();
        }else{
            // should I spin up a local tester for standalone
            if (options.child.length == 0){
                options.child.push(options.host + ':' + options.port);
            }
            // should I connect to a cluster to run my tests?
            if (options.child.length > 0){
                loadtester.startCluster(function(cluster){
                    console.log('\nAll tests done. exiting.\n');
                    process.exit(0);
                });
            }
        }
    }else{
        console.log("running as child. Please add " + options.host + ":" + options.port + " to the children of a test-master.");
    }
});