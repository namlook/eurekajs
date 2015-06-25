
import joi from 'joi';
import Glue from 'glue';

import HapiMailer from 'hapi-mailer';
import HapiAuthBasic from 'hapi-auth-basic';
import HapiAuthJwt from 'hapi-auth-jwt';
import archimedesPlugin from './plugins/archimedes';
import eurekaPlugin from './plugins/eureka';

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

var eurekaConfigValidator = {
    port: joi.number().required(),
    log: [joi.string(), joi.array(joi.string())],
    auth: joi.boolean(),
    app: joi.object().keys({
        secret: joi.string().required(),
        apiRootPrefix: joi.string().required(),
        email: joi.string().email().required(),
        clientRootUrl: joi.string().uri().required()
    }),
    database: joi.object().keys({
        adapter: joi.object().keys({
            type: joi.string().required(),
            dialect: joi.string(),
            graphURI: joi.string().uri().required()
        }).required(),
        host: joi.string().ip().default('localhost'),
        schemas: joi.object()
    }),
    resources: joi.object(),
    mailer: joi.object()
};


export default function(eurekaConfig) {
    var {error, value: config} = joi.validate(eurekaConfig, eurekaConfigValidator);

    if (error) {
        throw error.details;
    }

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


                    var archimedesPluginConfig = {
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


                    var eurekaPluginConfig = {
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
                        {register: archimedesPlugin, options: archimedesPluginConfig},
                        {register: eurekaPlugin, options: eurekaPluginConfig}

                    ], function(registerErr) {
                        if (registerErr) {
                            return callback(registerErr);
                        }


                        that.afterRegister(server, function(afterRegisterErr) {
                            if (afterRegisterErr) {
                                return callback(afterRegisterErr);
                            }



                            /**
                             * if config.auth is true, secure all routes
                             * with an access token. If so, a User model
                             * should be registered.
                             */
                            if (config.auth) {
                                if (!server.plugins.eureka.database.User) {
                                    return callback('config.auth is enabled but no User model has been registered');
                                }
                                server.log(['info', 'eureka'], 'config.auth is true, locking all routes by default');
                                server.auth.default({
                                    strategy: 'token'
                                });
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