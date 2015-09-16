
require('source-map-support').install();

import eureka from '../../lib';
import config from '../config';

import fixtures from '../utils/fixtures';


let eurekaServer = eureka(config);

eurekaServer.beforeRegister = function(_server, next) {
    _server.on('log', function(message) {
        console.log(message.tags, message.data);
    });
    next(null);
};

let server;
eurekaServer.start().then((startedServer) => {
    server = startedServer;
    return fixtures.clear(server);
}).then(() => {
    return fixtures.genericDocuments(server);
}).then(() => {
    fixtures.userDocuments(server);
}).then(() => {
    server.log('info', `Server running at: http://${server.info.address}:${server.info.port}`);
}).catch((error) => {
    console.log(error);
    console.log(error.stack);
    throw error;
});