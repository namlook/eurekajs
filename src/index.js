
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
        config: joi.object().keys({
            // type: joi.string().required(),
            // dialect: joi.string(),
            // host: joi.string().ip().default('localhost'),
            graphUri: joi.string().uri().required(),
            endpoint: joi.string().uri().required()
        }).required(),
        schemas: joi.object()
    }),
    fileUploads: joi.object().keys({
        maxBytes: joi.number().integer().default(50 * Math.pow(1024, 2)),
        uploadDirectory: joi.string().default()
    }),
    resources: joi.object(),
    mailer: joi.object()
};

export default function(eurekaConfig) {
    var {error, value: config} = joi.validate(eurekaConfig, eurekaConfigValidator);

    if (error) {
        console.log(error);
        throw error.details;
    }

    var manifest = {
        connections: [
            {
                port: config.port,
                query: {
                    /** the following line is necessary to allow
                     * deep relation query (via dot notation) ex:
                     *  `filter[relation.text]=foo`
                     */
                    qs: {allowDots: false}
                }
            }
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
                            config: config.database.config
                        },
                        schemas: config.database.schemas
                    };


                    var eurekaPluginConfig = {
                        log: config.log,
                        resources: config.resources,
                        apiRootPrefix: config.app.apiRootPrefix,
                        serverConfig: config
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

                            callback(null, server);
                        });
                    });
                });
            });
        },

        /**
         * compose, register plugins and start the server
         *
         * @returns a promise which resolve into the started server
         */
        start: function() {
            return new Promise((resolve, reject) => {
                this.compose((composeErr, server) => {
                    if (composeErr) {
                        return reject(composeErr);
                    }

                    this.beforeStart(server, (onPreStartErr) => {
                        if (onPreStartErr) {
                            return reject(onPreStartErr);
                        }

                        server.start((startErr) => {
                            if (startErr) {
                                return reject(startErr);
                            }
                            return resolve(server);
                        });
                    });
                });
            });

        }
    };
}