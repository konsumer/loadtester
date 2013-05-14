/**
 * Example testing script
 *
 * Simple load test for 3 minutes
 */

module.exports = {
    name: "jetboy",
    comment:"Simple load test for Jetboy Studio",
    host: 'www.jetboystudio.com',
    port: 80,
    timeLimit: 180,
    loadProfile: [[0,0], [180,400] ],
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