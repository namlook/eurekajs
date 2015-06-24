
import Lab from 'lab';
var lab = exports.lab = Lab.script();

import Code from 'code';
var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var beforeEach = lab.beforeEach;
var expect = Code.expect;

import eureka from '../../lib';
import config from '../config';
import fixtures from '../utils/fixtures';

import Bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';


describe('Authentification', function() {

    /** load the server **/
    var server;
    before(function(done) {
        eureka(config).compose(function(err, s) {
            expect(err).to.not.exists();
            server = s;
            done();
        });
    });

    /** load the fixtures **/
    beforeEach(function(done){
        fixtures.clear(server, function() {
            fixtures.genericDocuments(server, function() {
                fixtures.userDocuments(server, done);
            });
        });
    });

    describe('[signing up]', function() {


        it('should create a user with an encrypted password', (done) => {

            let options = {
                method: 'POST',
                url: '/api/1/auth',
                payload: {
                    login: 'newuser',
                    email: 'newuser@test.com',
                    password: 'secret'
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(201);
                expect(response.result.statusCode).to.equal(201);

                let user = response.result.results;
                expect(user._id).to.exist();
                expect(user._type).to.exist();
                expect(user.email).to.equal('newuser@test.com');
                expect(user.password).to.not.exists();

                let db = server.plugins.eureka.database;
                db.User.first({email: user.email}, (err, fetchedUser) => {
                    expect(err).to.be.null();
                    let fetchedPassword = fetchedUser.get('password');
                    expect(fetchedPassword).to.not.equal('secret');
                    let isValid = Bcrypt.compareSync('secret', fetchedPassword);
                    expect(isValid).to.be.true();
                    done();
                });

            });
        });

        it('should verify the email');

        describe('should return and error', function() {

            it('if the email is already taken', (done) => {

                let options = {
                    method: 'POST',
                    url: '/api/1/auth',
                    payload: {
                        login: 'newuser',
                        email: 'user1@test.com',
                        password: 'secret'
                    }
                };

                server.inject(options, function(response) {
                    expect(response.statusCode).to.equal(409);
                    expect(response.result.statusCode).to.equal(409);
                    expect(response.result.error).to.equal('Conflict');
                    expect(response.result.message).to.equal('email is taken');

                    done();
                });
            });


            it('if the email is invalid', (done) => {

                let options = {
                    method: 'POST',
                    url: '/api/1/auth',
                    payload: {
                        login: 'newuser',
                        email: 'thebad email',
                        password: 'secret'
                    }
                };

                server.inject(options, function(response) {
                    expect(response.statusCode).to.equal(400);
                    expect(response.result.statusCode).to.equal(400);
                    expect(response.result.error).to.equal('Bad Request');
                    expect(response.result.message).to.equal('child "email" fails because ["email" must be a valid email]');

                    done();
                });
            });



            it('if the email is missing', (done) => {

                let options = {
                    method: 'POST',
                    url: '/api/1/auth',
                    payload: {
                        login: 'newuser',
                        password: 'secret'
                    }
                };

                server.inject(options, function(response) {
                    expect(response.statusCode).to.equal(400);
                    expect(response.result.statusCode).to.equal(400);
                    expect(response.result.error).to.equal('Bad Request');
                    expect(response.result.message).to.equal('child "email" fails because ["email" is required]');

                    done();
                });
            });



            it('if the login is missing', (done) => {

                let options = {
                    method: 'POST',
                    url: '/api/1/auth',
                    payload: {
                        email: 'newuser@test.com',
                        password: 'secret'
                    }
                };

                server.inject(options, function(response) {
                    expect(response.statusCode).to.equal(400);
                    expect(response.result.statusCode).to.equal(400);
                    expect(response.result.error).to.equal('Bad Request');
                    expect(response.result.message).to.equal('child "login" fails because ["login" is required]');

                    done();
                });
            });


            it('if the password is missing', (done) => {

                let options = {
                    method: 'POST',
                    url: '/api/1/auth',
                    payload: {
                        login: 'newuser',
                        email: 'newuser@test.com'
                    }
                };

                server.inject(options, function(response) {
                    expect(response.statusCode).to.equal(400);
                    expect(response.result.statusCode).to.equal(400);
                    expect(response.result.error).to.equal('Bad Request');
                    expect(response.result.message).to.equal('child "password" fails because ["password" is required]');

                    done();
                });
            });

            it('if the login is already taken', (done) => {

                let options = {
                    method: 'POST',
                    url: '/api/1/auth',
                    payload: {
                        login: 'user1',
                        email: 'newuser@test.com',
                        password: 'secret'
                    }
                };

                server.inject(options, function(response) {
                    expect(response.statusCode).to.equal(409);
                    expect(response.result.statusCode).to.equal(409);
                    expect(response.result.error).to.equal('Conflict');
                    expect(response.result.message).to.equal('login is taken');

                    done();
                });
            });

        });

    });


    describe('[autentification]', function() {

        it('the user with an access token', (done) => {
            let basicDigest = new Buffer('user1@test.com:secret1').toString('base64');

            let options = {
                method: 'GET',
                url: '/api/1/auth',
                headers: {
                    Authorization: `Basic ${basicDigest}`
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);
                expect(response.result.results.token).to.exist();
                done();
            });
        });

    });

    describe('[reseting password]', function() {

        it('should send an email with the password reset token', (done) => {

            let options = {
                method: 'POST',
                url: '/api/1/auth/password-request',
                payload: {
                    email: 'user1@test.com'
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200)
                expect(response.result.results).to.equal('the password reset token has been send by email');

                done();
            });
        });



        it('should set the new password', (done) => {

            let options = {
                method: 'POST',
                url: '/api/1/auth/password-request',
                payload: {
                    email: 'user1@test.com'
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);
                expect(response.result.results).to.equal('the password reset token has been send by email');

                var email = 'user1@test.com';
                server.plugins.eureka.database.User.first({email: email}, (userErr, user) => {
                    expect(userErr).to.not.exists();

                    let token = jwt.sign(
                        {email: email, token: user.get('passwordResetToken')},
                        server.settings.app.secret,
                        {expiresInMinutes: 180}
                    );

                    let resetOptions = {
                        method: 'POST',
                        url: '/api/1/auth/password-reset',
                        payload: {
                            token: token,
                            password: 'newpassword'
                        }
                    };

                    server.inject(resetOptions, function(resetResponse) {
                        expect(resetResponse.statusCode).to.equal(200);
                        expect(resetResponse.result.statusCode).to.equal(200);

                        let db = server.plugins.eureka.database;
                        db.User.first({email: 'user1@test.com'}, (err, fetchedUser) => {
                            expect(err).to.be.null();

                            let isValid = Bcrypt.compareSync('newpassword', fetchedUser.get('password'));
                            expect(isValid).to.be.true();
                            done();
                        });
                    });
                });
            });
        });


        describe('should return an error', function() {

            it('if email doesnt exist', (done) => {
                let options = {
                    method: 'POST',
                    url: '/api/1/auth/password-request',
                    payload: {
                        email: 'nonexistingemail@test.com'
                    }
                };

                server.inject(options, function(response) {
                    expect(response.statusCode).to.equal(404);
                    expect(response.result.statusCode).to.equal(404);
                    expect(response.result.error).to.equal('Not Found');
                    expect(response.result.message).to.equal('email not found');

                    done();
                });
            });


            it('if email is invalid', (done) => {
                let options = {
                    method: 'POST',
                    url: '/api/1/auth/password-request',
                    payload: {
                        email: 'invalid email'
                    }
                };

                server.inject(options, function(response) {
                    expect(response.statusCode).to.equal(400);
                    expect(response.result.statusCode).to.equal(400);
                    expect(response.result.error).to.equal('Bad Request');
                    expect(response.result.message).to.equal('child "email" fails because ["email" must be a valid email]');

                    done();
                });
            });

            it('if the password reset token is used twice', (done) => {
                let options = {
                    method: 'POST',
                    url: '/api/1/auth/password-request',
                    payload: {
                        email: 'user1@test.com'
                    }
                };

                server.inject(options, function(response) {
                    expect(response.statusCode).to.equal(200);
                    expect(response.result.statusCode).to.equal(200);

                    expect(response.result.results).to.equal('the password reset token has been send by email');

                    var email = 'user1@test.com';
                    server.plugins.eureka.database.User.first({email: email}, (userErr, user) => {
                        expect(userErr).to.not.exists();

                        let token = jwt.sign(
                            {email: email, token: user.get('passwordResetToken')},
                            server.settings.app.secret,
                            {expiresInMinutes: 180}
                        );

                        let resetOptions = {
                            method: 'POST',
                            url: '/api/1/auth/password-reset',
                            payload: {
                                token: token,
                                password: 'newpassword'
                            }
                        };

                        server.inject(resetOptions, function(resetResponse) {
                            expect(resetResponse.statusCode).to.equal(200);
                            expect(resetResponse.result.statusCode).to.equal(200);
                            expect(resetResponse.result.results).to.equal('the password has been reset');

                            let resetOptions2 = {
                                method: 'POST',
                                url: '/api/1/auth/password-reset',
                                payload: {
                                    token: token,
                                    password: 'newpassword'
                                }
                            };

                            server.inject(resetOptions2, function(resetResponse2) {
                                expect(resetResponse2.statusCode).to.equal(400);
                                expect(resetResponse2.result.statusCode).to.equal(400);
                                expect(resetResponse2.result.error).to.equal('Bad Request');
                                expect(resetResponse2.result.message).to.equal('Cannot find a match. The token may have been used already.');
                                done();
                            });
                        });
                    });
                });
            });

        });

    });

});