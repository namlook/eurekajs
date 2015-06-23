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

describe('Authorization', function() {

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

    describe('[resource access]', function() {
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

        describe('should return an error', function() {
            it('if the user credentials are invalids', (done) => {
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
        it('should allow access to a user attempting to access its own document');
        it('should deny access to a user attempting to access someone else document');
        it('should allow access if the user is in the allowed groups');
        it('should denied access if the user is not in the allowed groups');
    });

    describe('[collection access]', function() {

        it('should allow access to a user attempting to access a list of documents');
        it('should denied access to a user attempting to access a list of documents');
        it("should return only the user's documents");

    });
});