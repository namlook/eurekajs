
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


    it("should raise an error if server's config.auth is true and no User model registered", (done) => {
        var schemas = config.database.schemas;
        config.database.schemas = {};
        eureka(config).compose((err) => {
            expect(err).to.equal('config.auth is enabled but no User model has been registered');
            config.database.schemas = schemas;
            done();
        });
    });


    it('should autenticate the user with an access token', (done) => {
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
            expect(response.result.statusCode).to.equal(200);
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



        it('if the token has expired', (done) => {
            let token = jwt.sign(
                {email: 'user1@test.com', token: 'thepasswordtoken'},
                server.settings.app.secret,
                {expiresInSeconds: 1}
            );

            setTimeout(() => {

                let options = {
                    method: 'POST',
                    url: '/api/1/auth/password-reset',
                    payload: {
                        token: token,
                        password: 'newpassword'
                    }
                };

                server.inject(options, function(response) {
                    expect(response.statusCode).to.equal(400);
                    expect(response.result.statusCode).to.equal(400);
                    expect(response.result.error).to.equal('Bad Request');
                    expect(response.result.message).to.equal('jwt expired');
                    done();
                });
            }, 1500);
        });



        it('if the token is malformed', (done) => {

            let options = {
                method: 'POST',
                url: '/api/1/auth/password-reset',
                payload: {
                    token: 'badtoken',
                    password: 'newpassword'
                }
            };

            server.inject(options, function(Response) {
                expect(Response.statusCode).to.equal(400);
                expect(Response.result.statusCode).to.equal(400);
                expect(Response.result.error).to.equal('Bad Request');
                expect(Response.result.message).to.equal('jwt malformed');
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