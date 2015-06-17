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

describe('Plugin', function(){

    beforeEach(function(done){
        loadFixtures(server, done);
    });


    it('should register a plugin', function(done) {
        request(application)
            .get('/api/1/plugin')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                expect(res.body.results).to.be.equal('plugin registered');
                done();
            });
    });

    it('should enhance all resources', function(done) {
        request(application)
            .get('/api/1/generic/i/plugin')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                expect(res.body.results).to.be.equal('plugin attached to generic');
                done();
            });
    });

    it('should walk through middlewares', function(done) {
        request(application)
            .get('/api/1/plugin/middlewares')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                expect(res.body.results).to.deep.equal(['mid1']);
                done();
            });
    });

    it('should add a base middleware', function(done) {
        request(application)
            .get('/api/1/plugin/middlewares/arf__')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                expect(res.body.results).to.equal('secret door found');

                request(application)
                    .get('/api/1/generic/i/count__')
                    .set('Accept', 'application/json')
                    .end(function(err2, res2){
                        expect(err2).to.be.null;
                        expect(res2).to.have.status(200);
                        expect(res2.body.results).to.equal('secret door found');
                        done();
                    });
            });
    });
});