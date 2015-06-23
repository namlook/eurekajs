
import jwt from 'jsonwebtoken';
import Bcrypt from 'bcrypt';
import joi from 'joi';

export default {
    prefix: '/auth',
    routes: [

        /** sign up a user **/
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
                                    return reply.badImplemendation(err);
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
                                    return reply.badImplemendation(err);
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
                        return reply.badImplemendation(saveErr);
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
         * Request a token.
         * The user must be authenticated by a simple auth (username, password)
         */
        {
            method: 'GET',
            path: '/',
            handler: function(request, reply) {
                let secret = request.server.settings.app.secret;
                let token = jwt.sign(request.auth.credentials, secret);
                reply.ok({token: token});
            },
            config: {
                auth: 'simple'
            }
        },

        // access to a secret resource via a token
        {
            method: 'GET',
            path: '/secret',
            handler: function(request, reply) {
                let user = request.auth.credentials;
                reply.ok({login: user});
            },
            config: {
                auth: 'token'
            }
        }

    ]
};