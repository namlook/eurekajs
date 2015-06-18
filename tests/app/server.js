
require('source-map-support').install();

import Glue from 'glue';
import manifest from './manifest';


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