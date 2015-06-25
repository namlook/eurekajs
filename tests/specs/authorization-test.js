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

import _ from 'lodash';
import jwt from 'jsonwebtoken';

var server;

var getToken = function(credentials) {
    return jwt.sign(
        credentials,
        server.settings.app.secret,
        {expiresInMinutes: 180}
    );
};

describe('Authorization', function() {

    /** load the server **/
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

    describe('[general access]', function() {
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
                var token = response.result.results.token;

                let tokenOptions = {
                    method: 'GET',
                    url: '/api/1/user/i/count',
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                };

                server.inject(tokenOptions, function(tokenResponse) {
                    expect(tokenResponse.statusCode).to.equal(200);
                    expect(tokenResponse.result.statusCode).to.equal(200);
                    done();
                });
            });
        });

        describe('should return an error', function() {
            it('if the user credentials are invalids', (done) => {
                var basicDigest = new Buffer('user1@test.com:badpassword').toString('base64');

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


            it('if the access token is malformed', (done) => {
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


            it('if the access token is invalid', (done) => {
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
    });

    describe('[document access]', function() {
        it('should allow access to a user attempting to access its own document', (done) => {

            var token = getToken({
                _id: 'user1',
                email: 'user1@test.com'
            });

            let options = {
                method: 'GET',
                url: '/api/1/user-stuff/userstuff1/only-for-me',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);
                done();
            });
        });


        it('should allow access if the user has an allowed role', (done) => {
            var token = getToken({
                _id: 'user1',
                email: 'user1@test.com',
                scope: 'secret-keeper'
            });

            let options = {
                method: 'GET',
                url: '/api/1/user-stuff/userstuff1/only-for-secretkeeper',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);
                done();
            });
        });


        it('should allow access if the user has a role specified in the document', (done) => {
            var token = getToken({
                _id: 'user1',
                email: 'user1@test.com',
                scope: 'secret-keeper'
            });

            let options = {
                method: 'GET',
                url: '/api/1/user-stuff/userstuff1/only-for-my-roles',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);
                let doc = response.result.results;
                expect(doc._scope).to.include(['secret-keeper']);
                done();
            });
        });


        it('should deny access to a user attempting to access someone else document', (done) => {

            var token = getToken({
                _id: 'user2',
                email: 'user2@test.com'
            });

            let options = {
                method: 'GET',
                url: '/api/1/user-stuff/userstuff1/only-for-me',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(401);
                expect(response.result.statusCode).to.equal(401);
                done();
            });
        });


        it('should denied access if the user has not an allowed role', (done) => {
            var token = getToken({
                _id: 'user1',
                email: 'user1@test.com',
                scope: 'cant-keep-a-secret'
            });

            let options = {
                method: 'GET',
                url: '/api/1/user-stuff/userstuff1/only-for-secretkeeper',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(403);
                expect(response.result.statusCode).to.equal(403);
                done();
            });
        });


        it('should denied access if the user has not a role specified in the document', (done) => {
            var token = getToken({
                _id: 'user1',
                email: 'user1@test.com',
                scope: 'cant-keep-a-secret'
            });

            let options = {
                method: 'GET',
                url: '/api/1/user-stuff/userstuff1/only-for-my-roles',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(401);
                expect(response.result.statusCode).to.equal(401);
                expect(response.result.error).to.equal('Unauthorized');
                expect(response.result.message).to.equal("you don't have the authorization to access this document");
                done();
            });
        });

        it('should throw an error if the scope is malformed (userId:doc.field)', (done) => {

            var token = getToken({
                _id: 'user1',
                email: 'user1@test.com',
                scope: 'cant-keep-a-secret'
            });

            let options = {
                method: 'GET',
                url: '/api/1/user-stuff/userstuff1/bad-scope',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(401);
                expect(response.result.statusCode).to.equal(401);
                done();
            });

        });

    });

    describe('[collection access]', function() {

        it('should grand access to a user that have an allowed role', (done) => {
            var token = getToken({
                _id: 'user1',
                email: 'user1@test.com',
                scope: ['secret-keeper']
            });

            let options = {
                method: 'GET',
                url: '/api/1/user-stuff/i/only-for-secretkeeper',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);
                done();
            });
        });


        it("should denied access to a user that don't have an allowed role", (done) => {
            var token = getToken({
                _id: 'user1',
                email: 'user1@test.com',
                scope: ['cant-keep-a-secret']
            });

            let options = {
                method: 'GET',
                url: '/api/1/user-stuff/i/only-for-secretkeeper',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(403);
                expect(response.result.statusCode).to.equal(403);
                done();
            });
        });


        it("should filter only the user's documents", (done) => {

            var token = getToken({
                _id: 'user1',
                email: 'user1@test.com'
            });

            let options = {
                method: 'GET',
                url: '/api/1/user-stuff/i/only-my-stuff',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);
                let docs = response.result.results;
                let owners = docs.map(o => o._owner);
                expect(owners).to.only.include(['user1']);
                expect(owners.length).to.equal(2);
                done();
            });
        });

        it("should filter only the user's documents (no match)", (done) => {

            var token = getToken({
                _id: 'user100',
                email: 'user100@test.com'
            });

            let options = {
                method: 'GET',
                url: '/api/1/user-stuff/i/only-my-stuff',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);
                let docs = response.result.results;
                expect(docs.length).to.equal(0);
                done();
            });
        });


        it('should filter document that have their scopes match the user role', (done) => {
            var token = getToken({
                _id: 'user1',
                email: 'user1@test.com',
                scope: 'secret-keeper'
            });

            let options = {
                method: 'GET',
                url: '/api/1/user-stuff/i/only-secretkeeper-documents',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);
                let scopes = response.result.results.map(function(o) {
                    return _.dropWhile(o._scope, (n) => n !== 'secret-keeper');
                });
                expect(scopes.length).to.equal(4);
                expect(_.flatten(scopes)).to.only.include(['secret-keeper']);
                done();
            });
        });

        it('should filter document that have their scopes match the user role (no match)', (done) => {
            var token = getToken({
                _id: 'user1',
                email: 'user1@test.com',
                scope: 'cant-keep-a-secret'
            });

            let options = {
                method: 'GET',
                url: '/api/1/user-stuff/i/only-secretkeeper-documents',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);
                expect(response.result.results.length).to.equal(0);
                done();
            });
        });
    });

    describe('[resource access]', function() {

        it("should give access to everyone if server's config.auth is false", (done) => {
            config.auth = false;
            eureka(config).compose((err, _server) => {
                expect(err).to.not.exists();

                let options = {
                    method: 'GET',
                    url: '/api/1/user'
                };

                _server.inject(options, function(response) {
                    expect(response.statusCode).to.equal(200);
                    expect(response.result.statusCode).to.equal(200);
                    expect(response.result.results).to.be.an.array();
                    config.auth = true;
                    done();
                });
            });
        });


        it("should secure all routes if server's config.auth is true", (done) => {
            eureka(config).compose((err, _server) => {
                expect(err).to.not.exists();

                let options = {
                    method: 'GET',
                    url: '/api/1/user'
                };

                _server.inject(options, function(response) {
                    expect(response.statusCode).to.equal(401);
                    expect(response.result.statusCode).to.equal(401);
                    done();
                });
            });
        });

        it('should allow access to all routes if the user has an allowed role', (done) => {
            var token = getToken({
                _id: 'user1',
                email: 'user1@test.com',
                scope: 'user-stuff-access'
            });

            let options = {
                method: 'GET',
                url: '/api/1/user-stuff/i/count',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);
                expect(response.result.results).to.equal(10);
                done();
            });
        });

        it('should denied access to all routes if the user has not an allowed role', (done) => {
            var token = getToken({
                _id: 'user1',
                email: 'user1@test.com',
                scope: 'cant-access-to-user-stuff'
            });

            let options = {
                method: 'GET',
                url: '/api/1/user-stuff/i/count',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(403);
                expect(response.result.statusCode).to.equal(403);
                done();
            });
        });
    });

});