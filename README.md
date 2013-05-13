# Loadtester

## NOT FINISHED, YET, STILL WORKING ON IT

This is a clustered javascript load-testing framework.  You can read more about it [here](http://blog.jetboystudio.com/2013/05/10/ec2-automated-testing.html)

## Installation

```
sudo npm install -g
```

## Usage

Make a loadtest that looks like this, and save it as mytest.js:

```javascript
// simple 3 minutes test

module.exports = {
    name: "yourhost",
    comment:"Simple load test for my cool site",
    host: 'www.yourhost.com',
    port: 80,
    timeLimit: 180,
    loadProfile: [[0,0], [180,400] ],
    log:false,
    slaveInterval: 2000,
    masterPort: 8000,
    stats: [
        'rps',
        'result-codes',
        {name: 'latency', percentiles: [0.95]},
        'concurrency',
        'request-bytes',
        'response-bytes'
    ],
    requestGenerator: function(client) {
        return client.request({method:'GET', path: '/'});
    }
};
```

Run it with this command: `loadtest mytest.js`

You can view the results at http://localhost:3000

### Clustering

You can run multiple children, and then push tests to them, like this:

`loadtest --child=host1.com:3000 --child=host2.com:3000 --child=host3.com:3000 mytest.js`

You can spin-up AWS instances to do the testing, like this:

`loadtest --instances=5 --authkey=deploy --key="BADWOLFBADWOLFBADWOLFBADWOLF" --secret="BADWOLFBADWOLFBADWOLFBADWOLFBADWOLFBADWOLF" --endpoint="us-west-2" mytest.js`

If you make a file called ~/.aws with JSON object of key, secret & endpoint, it will be used by default.

Obviously, replace the Doctor Who reference with your AWS credentials, and set endpoint to your favorite zone (us-west-2: Portland, represent!) Make a keypair called `deploy`