#!/bin/sh

# This will run on spun-up AWS child-servers to perform testing as a cluster

# install node, npm, & git
apt-get -y install python-software-properties software-properties-common python-software-properties
add-apt-repository -y ppa:chris-lea/node.js
apt-get update
apt-get -y install python g++ make nodejs git

# download loadtester and run as child
cd /usr/local/share
git clone https://github.com/konsumer/loadtester.git
cd loadtester
npm install
node cli.js