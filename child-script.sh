#!/bin/sh

# This will run on spun-up AWS child-servers to perfrom testing as a cluster

apt-get -y install python-software-properties software-properties-common python-software-properties
add-apt-repository -y ppa:chris-lea/node.js
apt-get update
apt-get -y install python g++ make nodejs git
git clone https://github.com/konsumer/loadtester.git
cd loadtester
npm -g install
loadtester