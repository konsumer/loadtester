/**
 * This is the controller that spins up AWS instances to run as a cluster
 *
  * make a file called ~/.aws: { "key": "EXAMPLE","secret": "EXAMPLE", "endpoint": "us-west-2"}
  */

var fs = require("fs"),
	path = require("path"),
	ec2 = require("ec2")(JSON.parse(fs.readFileSync(path.resolve(process.env.HOME, ".aws"), "utf8")));


// image is Ubuntu 12.10 64 server

/*
get machine in working order:

sudo apt-get -y install python-software-properties software-properties-common python-software-properties
sudo add-apt-repository -y ppa:chris-lea/node.js
sudo apt-get update
sudo apt-get -y install python g++ make nodejs npm git

(insert contents of deploy key into ~/.ssh/id_rsa)

git clone git@github.com:konsumer/INTEL_NA_13_0.git
cd INTEL_NA_13_0/

 */

// start 5 machines 
ec2("RunInstances", { ImageId: "ami-422ea672", KeyName: "deploy", MinCount: 5, MaxCount: 5, InstanceType:"t1.micro"}, function(error, response){

});