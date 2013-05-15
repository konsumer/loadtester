var nl = require('nss')
    http = require('http'),
    url = require('url'),
    fs = require('fs'),
    async = require('async');

/*

@var {Object} options Contains options for running loadtests

child      host & port of children to use to test                                [array of hosts&ports]
port       port to run on.                                                       [eg: 3000]
host       an externally accessable hostname for this instance.                  [your IP]
update     Update frequency (in seconds) for polling children                    [eg: 2]
comment    Comment for log/HTML output                                         
log        create a local HTML report log                                        [boolean]

instances  The number of AWS instances to spin-up and send tests to              [eg: 0]
authkey    Your AWS instance keypair to use                                      [eg: "deploy"]
group      The AWS security group that has port open                             [eg: "loadtest"]
machine    Your AWS AMI that will run this script                                [eg: "ami-422ea672"]
key        Your AWS auth key                                                     [your AWS key]
secret     Your AWS secret                                                       [your AWS secret]
endpoint   Your AWS endpoint zone                                                [eg: "us-west-2"]
timeout    Timeout (in seconds) for spinning up AWS machines                     [eg: 120]
script     The filename of the client startup script                             [eg: "./child-script.sh"]

 */

var options;

/**
 * Basic setup of NSS stuff
 * @param  {Object} op Options object
 */
function setup(op){
    options = op;

    process.setMaxListeners(0);
    nl.usePort(options.port);
    if (!options.log)
        nl.disableLogs();

    nl.setSlaveUpdateIntervalMs(options.update * 1000);

    if (options.comment)
        nl.setReportComment(options.comment);

    return module.exports;
}
module.exports = setup;


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
module.exports.checkCluster = checkCluster;

/**
 * Spin up a test-cluster
 * @param  {Function} callback Called when done, params: (cluster)
 */
function startCluster(callback){
    checkCluster(options.child, function(runningHosts){
        var cluster = new nl.LoadTestCluster(options.host + ':' + options.port, options.child);

        // setup exit strategy
        console.log("\nTest display running on http://" + options.host + ":" + options.port + "/ Ctrl-C to quit.");
        process.on('SIGINT', function () {
            console.log('\nGot SIGINT. Stopping test\n');
            cluster.end();
        });

        // run cluster
        cluster.run(options.test);
        callback(cluster);
    }, true);
}
module.exports.startCluster = startCluster;

/**
 * Spinup AWS instances, based on options
 */
function aws_spinup(){
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

            startCluster(function(cluster){
                cluster.on('end', function() {
                    var toKill = {};
                    instances.forEach(function(instance, i){
                        toKill['InstanceId.' + (i+1)] = instance.instanceId;
                    });
                    console.log("\nkilling", toKill);
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

    var coptions = {
        ImageId: options.machine,
        KeyName: options.authkey,
        MinCount: options.instances,
        MaxCount: options.instances,
        InstanceType:"t1.micro",
        SecurityGroup:options.group
    };

    if (options.script){
        coptions['UserData'] = new Buffer(fs.readFileSync(options.script)).toString('base64');
    }

    var ec2 = require("ec2")({key:options.key, secret:options.secret, endpoint:options.endpoint});
    ec2("RunInstances", coptions, running);
}
module.exports.aws_spinup = aws_spinup;
