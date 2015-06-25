
import jwt from 'jsonwebtoken';
import Bcrypt from 'bcrypt';
import joi from 'joi';
import _ from 'lodash';

export default {
    auth: false,
    prefix: '/auth',
    routes: [

        /**
         * sign up a new user
         */
        {
            method: 'POST',
            path: '/',
            config: {
                validate: {
                    payload: {
                        email: joi.string().email().required(),
                        login: joi.string().required(),
                        password: joi.string().required()
                    }
                },
                pre: [
                    {
                        assign: 'checkEmail',
                        method: function(request, reply) {
                            let {db, payload} = request;

                            db.User.first({email: payload.email}, (err, fetchedUser) => {
                                if (err) {
                                    return reply.badImplementation(err);
                                }

                                if (fetchedUser) {
                                    return reply.conflict('email is taken');
                                }

                                reply(true);
                            });
                        }
                    }, {
                        assign: 'checkLogin',
                        method: function(request, reply) {
                            let {db, payload} = request;

                            db.User.first({login: payload.login}, (err, fetchedUser) => {
                                if (err) {
                                    return reply.badImplementation(err);
                                }

                                if (fetchedUser) {
                                    return reply.conflict('login is taken');
                                }

                                reply(true);
                            });
                        }
                    }
                ]
            },
            handler: function(request, reply) {
                let {db, payload} = request;
                let secret = request.server.settings.app.secret;
                let user = new db.User(payload);
                let encryptedPassword = Bcrypt.hashSync(user.get('password'), 10);

                user.set('password', encryptedPassword);

                user.save((saveErr, savedUser) => {
                    if (saveErr) {
                        return reply.badImplementation(saveErr);
                    }

                    let userPojo = savedUser.toJSONObject({
                        fields: ['_id', '_type', 'login', 'email'] // TODO in archimedes
                    });

                    delete userPojo.password;

                    let token = jwt.sign(
                        {email: payload.email, userId: userPojo._id},
                        secret,
                        {expiresInMinutes: 180}
                    );

                    let base64Token = new Buffer(token).toString('base64');
                    let clientRootUrl = request.server.settings.app.clientRootUrl;

                    var envelope = {
                        from: request.server.settings.app.email,
                        to: user.get('email'),
                        subject: 'Email verification',
                        // html: {
                        //     path: 'email-verification.html'
                        // },
                        text: `Click on the following link to verify your email:
                            ${clientRootUrl}/verify-email?token=${base64Token}
                        `
                        // context: {
                        //     token: base64Token
                        // }
                    };

                    var Mailer = request.server.plugins.mailer;
                    Mailer.sendMail(envelope, function (mailError) {
                        if (mailError) {
                            return reply.badImplementation(mailError);
                        }
                        return reply.created(userPojo);
                    });

                });
            }
        },


        /**
         * Verify the user email
         */
        {
            method: 'GET',
            path: '/verify-email/{token}',
            config: {
                validate: {
                    params: {
                        token: joi.string().required()
                    }
                }
            },
            handler: function(request, reply) {
                let db = request.db;
                let token = request.params.token;
                let secret = request.server.settings.app.secret;

                jwt.verify(token, secret, function(err, decoded) {
                    if (err) {
                        return reply.badRequest(err.message);
                    }

                    db.User.first({email: decoded.email}, (firstErr, user) => {
                        if (firstErr) {
                            return reply.badImplementation(firstErr);
                        }

                        if (!user) {
                            return reply.badRequest('email not found in database');
                        }

                        user.set('emailVerified', true);

                        user.save((saveErr) => {
                            if (saveErr) {
                                return reply.badImplementation(saveErr);
                            }

                            reply.ok('the email has been verified');
                        });
                    });
                });
            }
        },

        /**
         * Request an access token.
         * The user must be authenticated by a simple auth (username, password)
         */
        {
            method: 'GET',
            path: '/',
            config: {
                auth: 'simple'
            },
            handler: function(request, reply) {
                let secret = request.server.settings.app.secret;
                let token = jwt.sign(request.auth.credentials, secret);
                reply.ok({token: token});
            }
        },


        /**
         * Request admin access token from a sudo user
         * (the returned token is valid for one hour)
         */
         {
            method: 'POST',
            path: '/sudo',
            config: {
                auth: {
                    strategy: 'token',
                    scope: ['sudo']
                }
            },
            handler: function(request, reply) {
                let secret = request.server.settings.app.secret;

                let credentials = request.auth.credentials;

                // add the admin scope to the user
                credentials.scope.push('admin');

                let token = jwt.sign(
                    credentials,
                    secret,
                    {expiresInMinutes: 60}
                );
                reply.ok({token: token});
            }
         },

         /*
         * Request admin access token from a sudo user
         * (the returned token is valid for one hour)
         */
         {
            method: 'DELETE',
            path: '/sudo',
            config: {
                auth: {
                    strategy: 'token',
                    scope: ['sudo', 'admin']
                },
                pre: [
                    {assign: 'scopeCheck', method: function(request, reply) {
                        let scope = request.auth.credentials.scope;
                        if (scope.indexOf('sudo') === -1) {
                            return reply.badRequest('only a sudo user can remove his access');
                        }

                        reply(true);
                    }}
                ]
            },
            handler: function(request, reply) {
                let secret = request.server.settings.app.secret;

                let credentials = request.auth.credentials;

                // remove 'admin' from scope
                credentials.scope = _.without(credentials.scope, 'admin');

                let token = jwt.sign(
                    credentials,
                    secret
                );
                reply.ok({token: token});
            }
         },

        /**
         * Request a token to change the password
         */
        {
            method: 'POST',
            path: '/password-request',
            config: {
                validate: {
                    payload: {
                        email: joi.string().email().required()
                    }
                },
                pre: [
                    {
                        assign: 'user',
                        method: function(request, reply) {
                            let {db, payload} = request;
                            db.User.first({email: payload.email}, function(err, user) {
                                if (err) {
                                    return reply.badImplementation(err);
                                }

                                if (!user) {
                                    return reply.notFound('email not found');
                                }

                                return reply(user);
                            });
                        }
                    }, {
                        assign: 'resetToken',
                        method: function(request, reply) {
                            let now = new Date();
                            let rand = Math.floor(Math.random() * 10000);
                            let token = parseInt(rand).toString(36) + parseInt(now.getTime()).toString(36);
                            reply(token);
                        }
                    }
                ]
            },
            handler: function(request, reply) {
                let secret = request.server.settings.app.secret;
                let {email} = request.payload;
                let {user, resetToken} = request.pre;

                user.set('passwordResetToken', resetToken);

                user.save(function(err) {
                    if (err) {
                        return reply.badImplementation(err);
                    }

                    let token = jwt.sign(
                        {email: email, token: resetToken},
                        secret,
                        {expiresInMinutes: 180}
                    );

                    let base64Token = new Buffer(token).toString('base64');
                    let clientRootUrl = request.server.settings.app.clientRootUrl;

                    var envelope = {
                        from: request.server.settings.app.email,
                        to: user.get('email'),
                        subject: 'Password reset',
                        // html: {
                        //     path: 'password-reset.html'
                        // },
                        text: `Click on the following link to reset your password:
                            ${clientRootUrl}/password-reset?token=${base64Token}
                        `
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

                });
            }
        },


        /**
         * Change the user password using the password token
         */
        {
            method: 'POST',
            path: '/password-reset',
            config: {
                validate: {
                    payload: {
                        token: joi.string().required(),
                        password: joi.string().required()
                    }
                },
                pre: [
                    {

                        assign: 'resetToken',
                        method: function(request, reply) {
                            let secret = request.server.settings.app.secret;
                            jwt.verify(request.payload.token, secret, function(err, decoded) {
                                if (err) {
                                    return reply.badRequest(err.message);
                                }

                                return reply(decoded.token);

                            });
                        }
                    }, {
                        assign: 'user',
                        method: function(request, reply) {
                            let {db} = request;
                            db.User.first({passwordResetToken: request.pre.resetToken}, function(err, user) {
                                if (err) {
                                    return reply.badImplementation(err);
                                }
                                if (!user) {
                                    return reply.badRequest('Cannot find a match. The token may have been used already.');
                                }

                                return reply(user);
                            });
                        }
                    }
                ]
            },
            handler: function(request, reply) {
                let {password} = request.payload;
                let user = request.pre.user;

                let encryptedPassword = Bcrypt.hashSync(password, 10);

                user.set('password', encryptedPassword);
                user.unset('passwordResetToken');

                user.save(function(err) {
                    if (err) {
                        return reply.badImplementation(err);
                    }
                    return reply.ok('the password has been reset');
                });
            }
        },


        /**
         * deleting a user account should be implemented
         * has it is always specific to the buisiness
         */
         {
            method: 'DELETE',
            path: '/{userId}',
            handler: function(request, reply) {
                return reply.notImplemented();
            }
         }

    ]
};