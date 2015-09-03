
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


describe('User creation', function() {

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
        fixtures.clear(server).then(() => {
            return fixtures.genericDocuments(server);
        }).then(() => {
            return fixtures.userDocuments(server);
        }).then(() => {
            done();
        }).catch((error) => {
            console.log(error);
        });
    });


    describe('[sign in]', function() {

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
                expect(user._id).to.exists();
                expect(user._type).to.exists();
                expect(user.email).to.equal('newuser@test.com');
                expect(user.password).to.not.exists();

                let db = server.plugins.eureka.database;
                db.User.first({email: user.email}).then((fetchedUser) => {
                    let fetchedPassword = fetchedUser.get('password');
                    expect(fetchedPassword).to.not.equal('secret');
                    let isValid = Bcrypt.compareSync('secret', fetchedPassword);
                    expect(isValid).to.be.true();
                    done();
                });
            });
        });

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


    describe('[email verification]', function() {


        it('should verify the email', (done) => {
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

                let token = jwt.sign(
                    {email: 'newuser@test.com'},
                    server.settings.app.secret,
                    {expiresInMinutes: 180}
                );

                let verifyOptions = {
                    method: 'GET',
                    url: `/api/1/auth/verify-email/${token}`
                };

                server.inject(verifyOptions, function(verifyResponse) {
                    expect(verifyResponse.statusCode).to.equal(200);
                    expect(verifyResponse.result.statusCode).to.equal(200);
                    expect(verifyResponse.result.results).to.equal('the email has been verified');

                    let db = server.plugins.eureka.database;
                    db.User.first({email: 'newuser@test.com'}).then((user) => {
                        expect(user.get('emailVerified')).to.be.true();
                        done();
                    });
                });
            });
        });


        it('should return an error if the token is expired', (done) => {
            let token = jwt.sign(
                {email: 'user1@test.com'},
                server.settings.app.secret,
                {expiresInSeconds: 1}
            );

            setTimeout(() => {
                let verifyOptions = {
                    method: 'GET',
                    url: `/api/1/auth/verify-email/${token}`
                };

                server.inject(verifyOptions, function(verifyResponse) {
                    expect(verifyResponse.statusCode).to.equal(400);
                    expect(verifyResponse.result.statusCode).to.equal(400);
                    expect(verifyResponse.result.error).to.equal('Bad Request');
                    expect(verifyResponse.result.message).to.equal('jwt expired');
                    done();
                });
            }, 1500);
        });


        it('should return an error if the token is malformed', (done) => {
            let verifyOptions = {
                method: 'GET',
                url: `/api/1/auth/verify-email/badtoken`
            };

            server.inject(verifyOptions, function(verifyResponse) {
                expect(verifyResponse.statusCode).to.equal(400);
                expect(verifyResponse.result.statusCode).to.equal(400);
                expect(verifyResponse.result.error).to.equal('Bad Request');
                expect(verifyResponse.result.message).to.equal('jwt malformed');
                done();
            });
        });

        it('should return an error if the email is somehow not in database', (done) => {
            let token = jwt.sign(
                {email: 'bademail@test.com'},
                server.settings.app.secret,
                {expiresInSeconds: 180}
            );

            let verifyOptions = {
                method: 'GET',
                url: `/api/1/auth/verify-email/${token}`
            };

            server.inject(verifyOptions, function(verifyResponse) {
                expect(verifyResponse.statusCode).to.equal(400);
                expect(verifyResponse.result.statusCode).to.equal(400);
                expect(verifyResponse.result.error).to.equal('Bad Request');
                expect(verifyResponse.result.message).to.equal('email not found in database');
                done();
            });
        });

    });

});