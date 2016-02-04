'use strict';

var _Promise = require('babel-runtime/core-js/promise')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _jsonwebtoken = require('jsonwebtoken');

var _jsonwebtoken2 = _interopRequireDefault(_jsonwebtoken);

var _bcrypt = require('bcrypt');

var _bcrypt2 = _interopRequireDefault(_bcrypt);

var _joi = require('joi');

var _joi2 = _interopRequireDefault(_joi);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _utils = require('../utils');

var _boom = require('boom');

var _boom2 = _interopRequireDefault(_boom);

var routes = {
    /**
     * sign up a new user
     */
    signUp: {
        method: 'POST',
        path: '/',
        config: {
            validate: {
                payload: {
                    email: _joi2['default'].string().email().required(),
                    login: _joi2['default'].string().required(),
                    password: _joi2['default'].string().required()
                }
            },
            pre: [{
                assign: 'checkEmail',
                method: function method(request, reply) {
                    var db = request.db;
                    var payload = request.payload;

                    db.User.first({ email: payload.email }).then(function (fetchedUser) {
                        if (fetchedUser) {
                            return reply.conflict('email is taken');
                        }

                        reply(true);
                    })['catch'](function (err) {
                        return reply.badImplementation(err);
                    });
                }
            }, {
                assign: 'checkLogin',
                method: function method(request, reply) {
                    var db = request.db;
                    var payload = request.payload;

                    db.User.first({ login: payload.login }).then(function (fetchedUser) {
                        if (fetchedUser) {
                            return reply.conflict('login is taken');
                        }

                        reply(true);
                    })['catch'](function (err) {
                        return reply.badImplementation(err);
                    });
                }
            }]
        },
        handler: function handler(request, reply) {
            var db = request.db;
            var payload = request.payload;
            var apiBaseUri = request.apiBaseUri;

            var secret = request.server.settings.app.secret;
            var user = db.User.create(payload);
            var encryptedPassword = _bcrypt2['default'].hashSync(user.get('password'), 10);

            user.set('password', encryptedPassword);

            user.save().then(function (savedUser) {

                var userPojo = _lodash2['default'].pick(savedUser.attrs(), ['_id', '_type', 'login', 'email']);

                delete userPojo.password;

                var token = _jsonwebtoken2['default'].sign({ email: payload.email, userId: userPojo._id }, secret, { expiresIn: 60 * 180 });

                var base64Token = new Buffer(token).toString('base64');
                var clientRootUrl = request.server.settings.app.clientRootUrl;

                var envelope = {
                    from: request.server.settings.app.email,
                    to: user.get('email'),
                    subject: 'Email verification',
                    // html: {
                    //     path: 'email-verification.html'
                    // },
                    text: 'Click on the following link to verify your email:\n                        ' + clientRootUrl + '/verify-email?token=' + base64Token + '\n                    '
                    // context: {
                    //     token: base64Token
                    // }
                };

                var Mailer = request.server.plugins.mailer;
                Mailer.sendMail(envelope, function (mailError) {
                    if (mailError) {
                        return reply.badImplementation(mailError);
                    }

                    var jsonApiData = {
                        data: (0, _utils.doc2jsonApi)(db.User, savedUser.attrs(), apiBaseUri)
                    };

                    delete jsonApiData.data.attributes.password;

                    return reply.created(jsonApiData).type('application/vnd.api+json');
                });
            })['catch'](function (saveErr) {
                return reply.badImplementation(saveErr);
            });
        }
    },

    /**
     * Verify the user email
     */
    verifyEmail: {
        method: 'GET',
        path: '/verify-email/{token}',
        config: {
            validate: {
                params: {
                    token: _joi2['default'].string().required()
                }
            }
        },
        handler: function handler(request, reply) {
            var db = request.db;
            var token = request.params.token;
            var secret = request.server.settings.app.secret;

            new _Promise(function (resolve, reject) {

                _jsonwebtoken2['default'].verify(token, secret, function (err, decoded) {
                    if (err) {
                        return reject(_boom2['default'].badRequest(err.message)); //reply.badRequest(err.message);
                    }
                    return resolve(decoded);
                });
            }).then(function (decoded) {

                return db.User.first({ email: decoded.email });
            }).then(function (user) {

                if (!user) {
                    throw _boom2['default'].badRequest('email not found in database');
                }

                user.set('emailVerified', true);

                return user.save();
            }).then(function (savedUser) {

                if (savedUser) {
                    return reply.ok('the email has been verified');
                }
            })['catch'](function (error) {

                if (error.isBoom) {
                    return reply(error);
                } else {
                    return reply.badImplementation(error);
                }
            });
        }
    },

    /**
    * Request an access token.
    * The user must be authenticated by a simple auth (username, password)
    */
    requestAcessToken: {
        method: 'GET',
        path: '/',
        config: {
            auth: 'simple'
        },
        handler: function handler(request, reply) {
            var secret = request.server.settings.app.secret;
            var token = _jsonwebtoken2['default'].sign(request.auth.credentials, secret);
            reply.ok({ token: token });
        }
    },

    /**
     * Add a scope to a user
     */
    addUserScope: {
        method: 'POST',
        path: '/{userId}/scope/{scope}',
        config: {
            auth: {
                strategy: 'token',
                access: {
                    scope: 'admin'
                }
            },
            validate: {
                params: {
                    userId: _joi2['default'].string().required(),
                    scope: _joi2['default'].string().required()
                }
            },
            pre: [{
                assign: 'user',
                method: function method(request, reply) {
                    var db = request.db;
                    var userId = request.params.userId;

                    db.User.first({ _id: userId }).then(function (user) {
                        if (!user) {
                            return reply.notFound('user not found');
                        }
                        return reply(user);
                    })['catch'](function (err) {
                        return reply.badImplementation(err);
                    });
                }
            }]
        },
        handler: function handler(request, reply) {
            var scope = request.params.scope;
            var user = request.pre.user;

            user.push('scope', scope);

            user.save().then(function () {
                return reply.ok(scope + ' added to user ' + user._id);
            })['catch'](function (err) {
                return reply.badImplementation(err);
            });
        }
    },

    /**
     * Remove a scope from a user
     */
    removeUserScope: {
        method: 'DELETE',
        path: '/{userId}/scope/{scope}',
        config: {
            auth: {
                strategy: 'token',
                access: {
                    scope: 'admin'
                }
            },
            validate: {
                params: {
                    userId: _joi2['default'].string().required(),
                    scope: _joi2['default'].string().required()
                }
            },
            pre: [{
                assign: 'user',
                method: function method(request, reply) {
                    var db = request.db;
                    var userId = request.params.userId;

                    db.User.first({ _id: userId }).then(function (user) {
                        if (!user) {
                            return reply.notFound('user not found');
                        }
                        return reply(user);
                    })['catch'](function (err) {
                        return reply.badImplementation(err);
                    });
                }
            }]
        },
        handler: function handler(request, reply) {
            var scope = request.params.scope;
            var user = request.pre.user;

            user.pull('scope', scope);

            user.save().then(function () {
                return reply.ok(scope + ' removed from user ' + user._id);
            })['catch'](function (err) {
                return reply.badImplementation(err);
            });
        }
    },

    /**
     * Request admin access token from a sudo user
     * (the returned token is valid for one hour)
     */
    sudo: {
        method: 'POST',
        path: '/sudo',
        config: {
            auth: {
                strategy: 'token',
                access: {
                    scope: ['sudo']
                }
            }
        },
        handler: function handler(request, reply) {
            var secret = request.server.settings.app.secret;

            var credentials = request.auth.credentials;

            // add the admin scope to the user
            credentials.scope.push('admin');

            var token = _jsonwebtoken2['default'].sign(credentials, secret, { expiresIn: 60 * 60 });
            reply.ok({ token: token });
        }
    },

    /*
    * Revoke admin access token from a sudo user
    * (the returned token is valid for one hour)
    */
    unsudo: {
        method: 'DELETE',
        path: '/sudo',
        config: {
            auth: {
                strategy: 'token',
                access: {
                    scope: ['sudo', 'admin']
                }
            },
            pre: [{ assign: 'scopeCheck', method: function method(request, reply) {
                    var scope = request.auth.credentials.scope;
                    if (scope.indexOf('sudo') === -1) {
                        return reply.forbidden('only a sudo user can remove his access');
                    }

                    reply(true);
                } }]
        },
        handler: function handler(request, reply) {
            var secret = request.server.settings.app.secret;

            var credentials = request.auth.credentials;

            // remove 'admin' from scope
            credentials.scope = _lodash2['default'].without(credentials.scope, 'admin');

            var token = _jsonwebtoken2['default'].sign(credentials, secret);
            reply.ok({ token: token });
        }
    },

    /**
     * Request a token to change the password
     */
    passwordRequest: {
        method: 'POST',
        path: '/password-request',
        config: {
            validate: {
                payload: {
                    email: _joi2['default'].string().email().required()
                }
            },
            pre: [{
                assign: 'user',
                method: function method(request, reply) {
                    var db = request.db;
                    var payload = request.payload;

                    db.User.first({ email: payload.email }).then(function (user) {
                        if (!user) {
                            return reply.notFound('email not found');
                        }

                        return reply(user);
                    })['catch'](function (err) {
                        return reply.badImplementation(err);
                    });
                }
            }, {
                assign: 'resetToken',
                method: function method(request, reply) {
                    var now = new Date();
                    var rand = Math.floor(Math.random() * 10000);
                    var token = parseInt(rand).toString(36) + parseInt(now.getTime()).toString(36);
                    reply(token);
                }
            }]
        },
        handler: function handler(request, reply) {
            var secret = request.server.settings.app.secret;
            var email = request.payload.email;
            var _request$pre = request.pre;
            var user = _request$pre.user;
            var resetToken = _request$pre.resetToken;

            user.set('passwordResetToken', resetToken);

            user.save().then(function () {
                var token = _jsonwebtoken2['default'].sign({ email: email, token: resetToken }, secret, { expiresIn: 60 * 180 });

                var base64Token = new Buffer(token).toString('base64');
                var clientRootUrl = request.server.settings.app.clientRootUrl;

                var envelope = {
                    from: request.server.settings.app.email,
                    to: user.get('email'),
                    subject: 'Password reset',
                    // html: {
                    //     path: 'password-reset.html'
                    // },
                    text: 'Click on the following link to reset your password:\n                        ' + clientRootUrl + '/password-reset?token=' + base64Token + '\n                    '
                    // context: {
                    //     token: base64Token
                    // }
                };

                var Mailer = request.server.plugins.mailer;
                Mailer.sendMail(envelope, function (mailError) {
                    if (mailError) {
                        return reply.badImplementation(mailError);
                    }
                    reply.ok('the password reset token has been send by email');
                });
            })['catch'](function (err) {
                return reply.badImplementation(err);
            });
        }
    },

    /**
     * Change the user password using the password token
     */
    passwordReset: {
        method: 'POST',
        path: '/password-reset',
        config: {
            validate: {
                payload: {
                    token: _joi2['default'].string().required(),
                    password: _joi2['default'].string().required()
                }
            },
            pre: [{

                assign: 'resetToken',
                method: function method(request, reply) {
                    var secret = request.server.settings.app.secret;
                    _jsonwebtoken2['default'].verify(request.payload.token, secret, function (err, decoded) {
                        if (err) {
                            return reply.badRequest(err.message);
                        }

                        return reply(decoded.token);
                    });
                }
            }, {
                assign: 'user',
                method: function method(request, reply) {
                    var db = request.db;

                    db.User.first({ passwordResetToken: request.pre.resetToken }).then(function (user) {
                        if (!user) {
                            return reply.badRequest('Cannot find a match. The token may have been used already.');
                        }

                        return reply(user);
                    })['catch'](function (err) {
                        return reply.badImplementation(err);
                    });
                }
            }]
        },
        handler: function handler(request, reply) {
            var password = request.payload.password;

            var user = request.pre.user;

            var encryptedPassword = _bcrypt2['default'].hashSync(password, 10);

            user.set('password', encryptedPassword);
            user.unset('passwordResetToken');

            user.save().then(function () {
                return reply.ok('the password has been reset');
            })['catch'](function (err) {
                return reply.badImplementation(err);
            });
        }
    }
};

exports['default'] = routes;
module.exports = exports['default'];