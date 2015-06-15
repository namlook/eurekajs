/* eslint-env node, mocha */
/* eslint no-unused-expressions:0 */

import request from 'supertest';
import chai from 'chai';
chai.use(require('chai-http'));
chai.config.includeStack = true;
var expect = chai.expect;

import server from '../server';
import loadFixtures from '../utils/load-fixtures';

server.mount();
var application = server.app;

describe.only('Auth plugin', function(){

    beforeEach(function(done){
        loadFixtures(server, done);
    });


    describe('signup', function() {
        it('should sign up a user', function(done) {
            request(application)
                .post('/api/1/auth')
                .send({
                    email: 'test@test.com',
                    password: 'secretpassword',
                    groups: ['in-loop']
                })
                .expect('Content-Type', /json/)
                .set('Accept', 'application/json')
                .end(function(err, res){
                    expect(err).to.be.null;
                    expect(res).to.have.status(201);
                    expect(res.body.status).to.equal(201);
                    let results = res.body.results;
                    expect(results.email).to.equal('test@test.com');
                    expect(results.password).to.equal('secretpassword');
                    expect(results.groups).to.deep.equal(['in-loop']);
                    done();
                });
        });

        describe('should raise an error', function() {

            it('if the password is less than 5 chars', function(done) {
                request(application)
                    .post('/api/1/auth')
                    .send({
                        email: 'test@test.com',
                        password: 'test',
                        groups: ['in-loop']
                    })
                    .expect('Content-Type', /json/)
                    .set('Accept', 'application/json')
                    .end(function(err, res){
                        expect(err.status).to.equal(400);
                        expect(res.body.error).to.equal('\"password\" length must be at least 5 characters long');
                        done();
                    });
            });

            it('if the email is not set', function(done) {
                request(application)
                    .post('/api/1/auth')
                    .send({
                        password: 'secrettest',
                        groups: ['in-loop']
                    })
                    .expect('Content-Type', /json/)
                    .set('Accept', 'application/json')
                    .end(function(err, res){
                        expect(err.status).to.equal(400);
                        expect(res.body.error).to.equal('"email" is required');
                        done();
                    });
            });

            it('if the password is not set', function(done) {
                request(application)
                    .post('/api/1/auth')
                    .send({
                        email: 'test@test.com',
                        groups: ['in-loop']
                    })
                    .expect('Content-Type', /json/)
                    .set('Accept', 'application/json')
                    .end(function(err, res){
                        expect(err.status).to.equal(400);
                        expect(res.body.error).to.equal('"password" is required');
                        done();
                    });
            });

        });
    });

    describe('signin', function() {
        it('should send a token when successfuly authenticated', function(done) {
            let user = {
                email: 'test@test.com',
                password: 'secretpassword',
                groups: ['in-loop']
            };
            request(application)
                .post('/api/1/auth')
                .send(user)
                .expect('Content-Type', /json/)
                .set('Accept', 'application/json')
                .end(function(err, res){
                    expect(err).to.be.null;
                    expect(res).to.have.status(201);

                    let authDigest = `${user.email}:${user.password}`;
                    authDigest = new Buffer(authDigest).toString('base64');

                    request(application)
                        .get('/api/1/auth')
                        .expect('Content-Type', /json/)
                        .set('Accept', 'application/json')
                        .set('Authorization', `Basic ${authDigest}`)
                        .end(function(err2, res2){
                            expect(err2).to.be.null;
                            expect(res2).to.have.status(200);
                            expect(res2.body.results.token).to.not.be.null;
                            done();
                        });
                });
        });


        it('should returns an error if no auth digest are passed to the header', function(done) {
            let user = {
                email: 'test@test.com',
                password: 'secretpassword',
                groups: ['in-loop']
            };
            request(application)
                .post('/api/1/auth')
                .send(user)
                .expect('Content-Type', /json/)
                .set('Accept', 'application/json')
                .end(function(err, res){
                    expect(err).to.be.null;
                    expect(res).to.have.status(201);

                    request(application)
                        .get('/api/1/auth')
                        .set('Accept', 'application/json')
                        .end(function(err2, res2){
                            expect(err2).to.be.not.null;
                            expect(res2).to.have.status(401);
                            done();
                        });
                });
        });

    });

    describe('policies', function() {
        it('should allow access to an authenticated user', function(done) {
           let user = {
                email: 'test@test.com',
                password: 'secretpassword'
            };
            request(application)
                .post('/api/1/auth')
                .send(user)
                .expect('Content-Type', /json/)
                .set('Accept', 'application/json')
                .end(function(err, res){
                    expect(err).to.be.null;
                    expect(res).to.have.status(201);

                    let authDigest = `${user.email}:${user.password}`;
                    authDigest = new Buffer(authDigest).toString('base64');

                    request(application)
                        .get('/api/1/auth')
                        .expect('Content-Type', /json/)
                        .set('Accept', 'application/json')
                        .set('Authorization', `Basic ${authDigest}`)
                        .end(function(err2, res2){
                            expect(err2).to.be.null;
                            expect(res2).to.have.status(200);
                            expect(res2.body.results.token).to.not.be.null;

                            var accessToken = res2.body.results.token;

                            request(application)
                                .get('/api/1/auth/secret')
                                .expect('Content-Type', /json/)
                                .set('Accept', 'application/json')
                                .set('Authorization', `JWT ${accessToken}`)
                                .end(function(err3, res3){
                                    expect(err3).to.be.null;
                                    expect(res3).to.have.status(200);
                                    expect(res3.body.results).to.equal('secret');
                                    done();
                                });

                        });
                });
        });

        it('should denied access a user is not authenticated', function(done) {

            request(application)
                .get('/api/1/auth/secret')
                .expect('Content-Type', /json/)
                .set('Accept', 'application/json')
                .end(function(err, res){
                    expect(err).to.not.be.null;
                    expect(res).to.have.status(401);
                    done();
                });

        });

        it('should allow access to an authenticated user within a group', function(done) {
           let user = {
                email: 'test@test.com',
                password: 'secretpassword',
                groups: ['in-loop']
            };
            request(application)
                .post('/api/1/auth')
                .send(user)
                .expect('Content-Type', /json/)
                .set('Accept', 'application/json')
                .end(function(err, res){
                    expect(err).to.be.null;
                    expect(res).to.have.status(201);

                    let authDigest = `${user.email}:${user.password}`;
                    authDigest = new Buffer(authDigest).toString('base64');

                    request(application)
                        .get('/api/1/auth')
                        .expect('Content-Type', /json/)
                        .set('Accept', 'application/json')
                        .set('Authorization', `Basic ${authDigest}`)
                        .end(function(err2, res2){
                            expect(err2).to.be.null;
                            expect(res2).to.have.status(200);
                            expect(res2.body.results.token).to.not.be.null;

                            var accessToken = res2.body.results.token;

                            request(application)
                                .get('/api/1/auth/very-secret')
                                .expect('Content-Type', /json/)
                                .set('Accept', 'application/json')
                                .set('Authorization', `JWT ${accessToken}`)
                                .end(function(err3, res3){
                                    expect(err3).to.be.null;
                                    expect(res3).to.have.status(200);
                                    expect(res3.body.results).to.equal('secret for people in the loop');
                                    done();
                                });

                        });
                });
        });

        it('should allow access via multiple policies', function(done) {
           let user = {
                email: 'test@test.com',
                password: 'secretpassword',
                groups: ['not-in-loop', 'boss']
            };
            request(application)
                .post('/api/1/auth')
                .send(user)
                .expect('Content-Type', /json/)
                .set('Accept', 'application/json')
                .end(function(err, res){
                    expect(err).to.be.null;
                    expect(res).to.have.status(201);

                    let authDigest = `${user.email}:${user.password}`;
                    authDigest = new Buffer(authDigest).toString('base64');

                    request(application)
                        .get('/api/1/auth')
                        .expect('Content-Type', /json/)
                        .set('Accept', 'application/json')
                        .set('Authorization', `Basic ${authDigest}`)
                        .end(function(err2, res2){
                            expect(err2).to.be.null;
                            expect(res2).to.have.status(200);
                            expect(res2.body.results.token).to.not.be.null;

                            var accessToken = res2.body.results.token;

                            request(application)
                                .get('/api/1/auth/very-secret')
                                .expect('Content-Type', /json/)
                                .set('Accept', 'application/json')
                                .set('Authorization', `JWT ${accessToken}`)
                                .end(function(err3, res3){
                                    expect(res3).to.have.status(200);
                                    expect(res3.body.results).to.equal('secret for people in the loop');
                                    done();
                                });

                        });
                });
        });

        it.only('should allow access with function as policy', function(done) {
           let user = {
                email: 'theboss@company.com',
                password: 'secretpassword',
                groups: []
            };
            request(application)
                .post('/api/1/auth')
                .send(user)
                .expect('Content-Type', /json/)
                .set('Accept', 'application/json')
                .end(function(err, res){
                    expect(err).to.be.null;
                    expect(res).to.have.status(201);

                    let authDigest = `${user.email}:${user.password}`;
                    authDigest = new Buffer(authDigest).toString('base64');

                    request(application)
                        .get('/api/1/auth')
                        .expect('Content-Type', /json/)
                        .set('Accept', 'application/json')
                        .set('Authorization', `Basic ${authDigest}`)
                        .end(function(err2, res2){
                            expect(err2).to.be.null;
                            expect(res2).to.have.status(200);
                            expect(res2.body.results.token).to.not.be.null;

                            var accessToken = res2.body.results.token;

                            request(application)
                                .get('/api/1/auth/very-secret')
                                .expect('Content-Type', /json/)
                                .set('Accept', 'application/json')
                                .set('Authorization', `JWT ${accessToken}`)
                                .end(function(err3, res3){
                                    expect(res3).to.have.status(200);
                                    expect(res3.body.results).to.equal('secret for people in the loop');
                                    done();
                                });

                        });
                });
        });


        it('should denied access if the user is not in the wanted group', function(done) {
           let user = {
                email: 'test@test.com',
                password: 'secretpassword',
                groups: ['not-in-loop']
            };
            request(application)
                .post('/api/1/auth')
                .send(user)
                .expect('Content-Type', /json/)
                .set('Accept', 'application/json')
                .end(function(err, res){
                    expect(err).to.be.null;
                    expect(res).to.have.status(201);

                    let authDigest = `${user.email}:${user.password}`;
                    authDigest = new Buffer(authDigest).toString('base64');

                    request(application)
                        .get('/api/1/auth')
                        .expect('Content-Type', /json/)
                        .set('Accept', 'application/json')
                        .set('Authorization', `Basic ${authDigest}`)
                        .end(function(err2, res2){
                            expect(err2).to.be.null;
                            expect(res2).to.have.status(200);
                            expect(res2.body.results.token).to.not.be.null;

                            var accessToken = res2.body.results.token;

                            request(application)
                                .get('/api/1/auth/very-secret')
                                .expect('Content-Type', /json/)
                                .set('Accept', 'application/json')
                                .set('Authorization', `JWT ${accessToken}`)
                                .end(function(err3, res3){
                                    expect(err3).to.be.not.null;
                                    expect(res3).to.have.status(401);
                                    done();
                                });

                        });
                });
        });
    });
});