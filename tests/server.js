
require('source-map-support').install();

var EurekaServer = require('../lib/server');
var eurekaMiddlewares = require('../lib/middlewares');
var requireDir = require('require-dir');

var app = new EurekaServer({
    name: 'Test',
    version: 1,
    port: 4000,
    database: {
        adapter: 'rdf',
        config: {
            store: 'virtuoso',
            host: '192.168.99.100',
            graphURI: 'http://test.org'
        }
    },
    resources: requireDir('./resources'),
    schemas: requireDir('./schemas'),
    middlewares: function(server) {
        return eurekaMiddlewares(server).concat([
            /** put your app middlewares here **/
        ]);
    }
});

module.exports = app;

if (require.main === module) {
    app.start();
}