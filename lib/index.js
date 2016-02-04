'use strict';

var _Promise = require('babel-runtime/core-js/promise')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _joi = require('joi');

var _joi2 = _interopRequireDefault(_joi);

var _glue = require('glue');

var _glue2 = _interopRequireDefault(_glue);

var _inert = require('inert');

var _inert2 = _interopRequireDefault(_inert);

var _hapiMailer = require('hapi-mailer');

var _hapiMailer2 = _interopRequireDefault(_hapiMailer);

var _hapiAuthBasic = require('hapi-auth-basic');

var _hapiAuthBasic2 = _interopRequireDefault(_hapiAuthBasic);

var _hapiAuthJwt = require('hapi-auth-jwt');

var _hapiAuthJwt2 = _interopRequireDefault(_hapiAuthJwt);

var _hapiQs = require('hapi-qs');

var _hapiQs2 = _interopRequireDefault(_hapiQs);

var _pluginsArchimedes = require('./plugins/archimedes');

var _pluginsArchimedes2 = _interopRequireDefault(_pluginsArchimedes);

var _pluginsEureka = require('./plugins/eureka');

var _pluginsEureka2 = _interopRequireDefault(_pluginsEureka);

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
    name: _joi2['default'].string(),
    host: _joi2['default'].string().required(),
    port: _joi2['default'].number().required(),
    log: [_joi2['default'].string(), _joi2['default'].array(_joi2['default'].string())],
    auth: _joi2['default'].boolean(),
    app: _joi2['default'].object().keys({
        secret: _joi2['default'].string().required(),
        apiRootPrefix: _joi2['default'].string().required(),
        email: _joi2['default'].string().email().required(),
        clientRootUrl: _joi2['default'].string().uri().required()
    }),
    publicDirectory: _joi2['default'].string()['default']('dist'),
    database: _joi2['default'].object().keys({
        config: _joi2['default'].object().keys({
            // type: joi.string().required(),
            // dialect: joi.string(),
            // host: joi.string().ip().default('localhost'),
            graphUri: _joi2['default'].string().uri().required(),
            endpoint: _joi2['default'].string().uri().required()
        }).required(),
        schemas: _joi2['default'].object()
    }),
    fileUploads: _joi2['default'].object().keys({
        maxBytes: _joi2['default'].number().integer()['default'](50 * Math.pow(1024, 2)),
        uploadDirectory: _joi2['default'].string()['default']()
    }),
    resources: _joi2['default'].object(),
    mailer: _joi2['default'].object(),
    misc: _joi2['default'].object() // place to put custom config here
};

exports['default'] = function (eurekaConfig) {
    var _joi$validate = _joi2['default'].validate(eurekaConfig, eurekaConfigValidator);

    var error = _joi$validate.error;
    var config = _joi$validate.value;

    if (error) {
        console.error(error);
        console.error(error.details);
        throw error;
    }

    var manifest = {
        connections: [{
            port: config.port,
            routes: { cors: true }
        }],
        server: {
            app: config.app
        }
    };

    return {
        manifest: manifest,

        beforeRegister: function beforeRegister(server, next) {
            next();
        },

        afterRegister: function afterRegister(server, next) {
            next();
        },

        beforeStart: function beforeStart(server, next) {
            next();
        },

        /**
         * compose the server and register plugins
         */
        compose: function compose(callback) {
            var that = this;

            _glue2['default'].compose(manifest, function (composeErr, server) {
                if (composeErr) {
                    return callback(composeErr);
                }

                that.beforeRegister(server, function (beforeRegisterErr) {
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
                    server.register([_hapiQs2['default'], _inert2['default'], { register: _hapiMailer2['default'], options: config.mailer }, _hapiAuthBasic2['default'], _hapiAuthJwt2['default'], { register: _pluginsArchimedes2['default'], options: archimedesPluginConfig }, { register: _pluginsEureka2['default'], options: eurekaPluginConfig }], function (registerErr) {
                        if (registerErr) {
                            return callback(registerErr);
                        }

                        that.afterRegister(server, function (afterRegisterErr) {
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
        start: function start() {
            var _this = this;

            return new _Promise(function (resolve, reject) {
                _this.compose(function (composeErr, server) {
                    if (composeErr) {
                        return reject(composeErr);
                    }

                    _this.beforeStart(server, function (onPreStartErr) {
                        if (onPreStartErr) {
                            return reject(onPreStartErr);
                        }

                        server.start(function (startErr) {
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
};

module.exports = exports['default'];