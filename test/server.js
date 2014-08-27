
var Eurekapi = require('../lib');

module.exports = new Eurekapi({
    name: 'Test',
    version: 1,
    port: 4000,
    database: {
        adapter: 'rdf',
        config: {
            store: 'virtuoso',
            graphURI: 'http://test.org'
        }
    },
    schemas: {
        Literal: {
            schema: {
                string: {
                    type: 'string'
                },
                boolean: {
                    type: 'bool'
                },
                integer: {
                    type: 'integer'
                },
                float: {
                    type: 'float',
                    precision: 3
                },
                date: {
                    type: 'date'
                }
            }
        }
    }
});
