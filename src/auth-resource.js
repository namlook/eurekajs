
import jwt from 'jsonwebtoken';
import Bcrypt from 'bcrypt';
import joi from 'joi';

export default {
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

                    return reply.created(userPojo);
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
                    // console.log(data);
                    Mailer.sendMail(envelope, function (mailError, infos) {
                        if (mailError) {
                            return reply.badImplementation(mailError);
                        }
                        // console.log('---', infos);
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
                                    return reply.badRequest(decoded.message);
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
        }

    ]
};