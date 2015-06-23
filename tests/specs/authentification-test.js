
import Lab from 'lab';
var lab = exports.lab = Lab.script();

import Code from 'code';
var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var beforeEach = lab.beforeEach;
var expect = Code.expect;

import manifest from '../app/manifest';
import Glue from 'glue';

import fixtures from '../utils/fixtures';

describe('Authentification', function() {

    /** load the server **/
    var server;
    before(function(done) {
        Glue.compose(manifest, function(err, s) {
            expect(err).to.be.null();
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
                expect(fetchedUser.get('password')).to.not.equal('secret');
                done();
            });

        });
    });


    it('should return an error if the email is already taken', (done) => {

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


    it('should return an error if the email is invalid', (done) => {

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



    it('should return an error if the email is missing', (done) => {

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



    it('should return an error if the login is missing', (done) => {

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


    it('should return an error if the password is missing', (done) => {

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

    it('should return an error if the login is already taken', (done) => {

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


    it('should allow the user to get an access token', (done) => {
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


    it('should return an error if the user credentials are invalids', (done) => {
        let basicDigest = new Buffer('user1@test.com:badpassword').toString('base64');

        let options = {
            method: 'GET',
            url: '/api/1/auth',
            headers: {
                Authorization: `Basic ${basicDigest}`
            }
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(401);
            expect(response.result.statusCode).to.equal(401);
            expect(response.result.error).to.equal('Unauthorized');
            expect(response.result.message).to.equal('Bad username or password');
            done();
        });
    });

    it('should allow access to a resource protected by token', (done) => {

        let options = {
            method: 'GET',
            url: '/api/1/auth',
            credentials: {
                _id: 'user1',
                email: 'user1@test.com'
            }
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(200);
            expect(response.result.statusCode).to.equal(200);
            let token = response.result.results.token;

            let tokenOptions = {
                method: 'GET',
                url: '/api/1/user-stuff/userstuff1/only-auth',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            server.inject(tokenOptions, function(tokenResponse) {
                expect(tokenResponse.statusCode).to.equal(200);
                expect(tokenResponse.result.statusCode).to.equal(200);

                let doc = tokenResponse.result.results;
                expect(doc._id).to.equal('userstuff1');
                expect(doc._owner).to.equal('user1');
                expect(doc.title).to.equal('the secret thing of user 1');
                expect(doc.isSecret).to.be.true();

                done();
            });
        });
    });


    it('should return an error if the token is malformed', (done) => {
        let options = {
            method: 'GET',
            url: '/api/1/user-stuff/userstuff1/only-auth',
            headers: {
                Authorization: `Bearer badtoken`
            }
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(400);
            expect(response.result.statusCode).to.equal(400);
            expect(response.result.error).to.equal('Bad Request');
            expect(response.result.message).to.equal('Bad HTTP authentication header format');
            done();
        });
    });


    it('should return an error if the token is invalid', (done) => {
        let options = {
            method: 'GET',
            url: '/api/1/user-stuff/userstuff1/only-auth',
            headers: {
                Authorization: `Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJuYW1lIjoibmljbyIsImlhdCI6MTQzNDk3NTU5N30.BDYlQTXhLgUzbgkT8PfWScsUekhYmW-Ex5HRQXiDNRJ`
            }
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(401);
            expect(response.result.statusCode).to.equal(401);
            expect(response.result.error).to.equal('Unauthorized');
            expect(response.result.message).to.equal('Invalid signature received for JSON Web Token validation');
            done();
        });
    });


});