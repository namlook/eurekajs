
require('source-map-support').install();

import eureka from '../../lib';
import config from '../config';

import fixtures from '../utils/fixtures';


let eurekaServer = eureka(config);

eurekaServer.beforeRegister = function(server, next) {
    server.on('log', function(message) {
        console.log(message.tags, message.data);
    });
    next(null);
};

eurekaServer.start(function(err, server) {
    if (err) {
        throw err;
    }

    fixtures.clear(server).then(() => {
        return fixtures.genericDocuments(server);
    }).then(() => {
        fixtures.userDocuments(server);
    }).then(() => {
        server.log('info', `Server running at: http://${server.info.address}:${server.info.port}`);
    }).catch((error) => {
        console.log(error);
    });

});
