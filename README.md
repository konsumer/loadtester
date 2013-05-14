# Loadtester

This is a clustered javascript load-testing framework.  You can read more about it [here](http://blog.jetboystudio.com/2013/05/10/ec2-automated-testing.html)

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
