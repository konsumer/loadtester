# Loadtester

This is a clustered javascript load-testing framework.  You can read more about it [here](http://blog.jetboystudio.com/articles/ec2-automated-testing/)

## Installation

```
sudo npm install -g
```

## Usage

Get help with `loadtest --help`

### Test format

Copy example-test.js to your own file and edit. The basic format is layed out [here](https://github.com/Samuel29/NodeStressSuite). Basically, it's a test (with a passed client) and some testing options.

It runs in 4 modes: Standalone, AWS Mother, Manual Child, and Manual Mother.


### Standalone

Run it with this command: `loadtest mytest.js`

You can view the results at http://localhost:3000


### AWS Mother

This will spin-up AWS children to run the test. You can view the results at http://localhost:3000

Put your AWS credentials in `~/.aws`, like this:

```json
{
    "key":"BADWOLFBADWOLFBADWOLFBADWOLF",
    "secret":"BADWOLFBADWOLFBADWOLFBADWOLFBADWOLFBADWOLF",
    "endpoint": "us-west-2"
}
```

Obviously, replace the Doctor Who reference with your AWS credentials, and set endpoint to your favorite zone (us-west-2: Portland, represent!) Make a keypair called `deploy` and create a security-group called `loadtest` that opens ports 22 (ssh) and 3000 (default test port.)

Run it with `loadtest --instances=5 mytest.js`

You can manually specify your credentials/zone on command line:

`loadtest --instances=5 mytest.js --key=BADWOLFBADWOLFBADWOLFBADWOLF --secret=BADWOLFBADWOLFBADWOLFBADWOLFBADWOLFBADWOLF --endpoint=us-west-2`

The child setup script (child-script.sh) is tailored for an Ubuntu machine. The basic idea is to get the tools needed to download & run loadtester onto the machine from a pristine state. Feel free to modify it.


### Manual Child

If you have a mother setup somewhere else, you can just run loadtester without any test, and it will enter "child" mode. You will need to add the host/port to --child option of a mother, manually.


### Manual Mother

If you have children running somewhere, already (using AWS Mother or Manual Child mode, above) connect to them and send a test liek this:

`loadtest mytest.js --child=host1:3000 --child=host2:6000 --child=host3:9000`


## Library Usage

You can also use it as a library, by running this in your project dir: `npm --save install "git://github.com/konsumer/loadtester.git"`

And now, you can do this:

```javascript
var loadtester = require('loadtester')(options);
```

`options` mirrors the CLI options:

```
child      host & port of children to use to test                                [array of hosts&ports]
port       port to run on.                                                       [eg: 3000]
host       an externally accessable hostname for this instance.                  [your IP]
update     Update frequency (in seconds) for polling children                    [eg: 2]
comment    Comment for log/HTML output                                         
log        create a local HTML report log                                        [boolean]

instances  The number of AWS instances to spin-up and send tests to              [eg: 0]
authkey    Your AWS instance keypair to use                                      [eg: "deploy"]
group      The AWS security group that has port open                             [eg: "loadtest"]
machine    Your AWS AMI that will run this script                                [eg: "ami-bf1d8a8f"]
key        Your AWS auth key                                                     [your AWS key]
secret     Your AWS secret                                                       [your AWS secret]
endpoint   Your AWS endpoint zone                                                [eg: "us-west-2"]
timeout    Timeout (in seconds) for spinning up AWS machines                     [eg: 120]
script     The filename of the client startup script                             [eg: "./child-script.sh"]
```

It has these functions that all use the initial options you gave it:

```
/**
 * Check a cluster of machines
 * @param  {Array}    checkHosts   Array of hosts to check
 * @param  {Function} callback     Called when done, params: (runningHosts)
 * @param  {Boolean}  runUntilTrue Keep polling until all hosts up?
 */
function checkCluster(checkHosts, callback, runUntilTrue)

/**
 * Spin up a test-cluster
 * @param  {Function} callback Called when done, params: (cluster)
 */
function startCluster(callback)

/**
 * Spinup AWS instances, based on options
 */
function aws_spinup()

```




