
require('source-map-support').install();

import Glue from 'glue';
import resources from './resources';

console.log('------', resources);

var manifest = {
    connections: [
        {port: 5000}
    ],
    plugins: {
        '../../../lib/plugins/archimedes': {
            log: 'warn',
            database: {
                adapter: 'rdf',
                config: {
                    store: 'virtuoso',
                    host: '192.168.99.100',
                    graphURI: 'http://test.org'
                }
            },
            schemas: {} //requireDir('./schemas'),
        },
        '../../../lib/plugins/eureka': {
            resources: resources
        }
    }
};

Glue.compose(manifest, function(err, server) {
    if (err) {
        throw err;
    }

    server.on('log', function(message) {
        console.log(message.tags, message.data);
    });

    server.start(function(startErr) {
        if (startErr) {
            throw startErr;
        }

        server.log('info', `Server running at: http://${server.info.address}:${server.info.port}`);
    });

});
