
import Glue from 'glue';

import HapiMailer from 'hapi-mailer';
import HapiAuthBasic from 'hapi-auth-basic';
import HapiAuthJwt from 'hapi-auth-jwt';
import archimedesPlugin from './plugins/archimedes';
import eurekaPlugin from './plugins/eureka';
import policiesPlugin from './plugins/policies';

// var exampleConfig = {
//     port: 5000,
//     log: ['warn'],
//     app: {
//         secret: 'ssh',
//         email: 'contact@project.com',
//         clientRootUrl: 'http://www.project.com',
//         apiRootPrefix: '/api/1'
//     },
//     mailer: {
//         // hapi-mailer config
//     },
//     database: {
//         adapter: {
//             type: 'rdf',
//             dialect: 'virtuoso',
//             graphURI: 'http://test.org'
//         },
//         host: '192.168.99.100',
//         schemas: requireDir('./schemas'),
//     },
//     resources: requireDir('./resources')
// };


export default function(config) {
    var manifest = {
        connections: [
            {port: config.port}
        ],
        server: {
            app: config.app
        }
    };

    return {
        manifest: manifest,

        beforeRegister: function(server, next) {
            next();
        },

        afterRegister: function(server, next) {
            next();
        },

        beforeStart: function(server, next) {
            next();
        },

        /**
         * compose the server and register plugins
         */
        compose: function(callback) {
            var that = this;

            Glue.compose(manifest, function(composeErr, server) {
                if (composeErr) {
                    return callback(composeErr);
                }

                that.beforeRegister(server, function(beforeRegisterErr) {
                    if (beforeRegisterErr) {
                        return callback(beforeRegisterErr);
                    }


                    var archimedesConfig = {
                        log: config.log,
                        database: {
                            adapter: config.database.adapter.type,
                            config: {
                                store: config.database.adapter.dialect,
                                host: config.database.host,
                                graphURI: config.database.adapter.graphURI
                            }
                        },
                        schemas: config.database.schemas
                    };


                    var eurekaConfig = {
                        log: config.log,
                        resources: config.resources,
                        apiRootPrefix: config.app.apiRootPrefix
                    };


                    /**
                     * register plugins
                     */
                    server.register([
                        {register: HapiMailer, options: config.mailer},
                        HapiAuthBasic,
                        HapiAuthJwt,
                        {register: archimedesPlugin, options: archimedesConfig},
                        {register: eurekaPlugin, options: eurekaConfig},
                        policiesPlugin

                    ], function(registerErr) {
                        if (registerErr) {
                            return callback(registerErr);
                        }


                        that.afterRegister(server, function(afterRegisterErr) {
                            if (afterRegisterErr) {
                                return callback(afterRegisterErr);
                            }

                            callback(null, server);
                        });
                    });
                });
            });
        },

        /**
         * compose, register plugins and start the server
         */
        start: function(callback) {

            var that = this;

            that.compose(function(composeErr, server) {
                if (composeErr) {
                    return callback(composeErr);
                }

                that.beforeStart(server, function(onPreStartErr) {
                    if (onPreStartErr) {
                        return callback(onPreStartErr);
                    }

                    server.start(function(startErr) {
                        return callback(startErr, server);
                    });
                });
            });
        }
    };
}