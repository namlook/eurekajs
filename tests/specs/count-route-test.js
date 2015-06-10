/* eslint-env node, mocha */
/* eslint no-unused-expressions:0 */

import request from 'supertest';
import chai from 'chai';
chai.use(require('chai-http'));
chai.config.includeStack = true;
var expect = chai.expect;

import server from '../server';
import loadFixtures from '../utils/load-fixtures';

describe('Route: [count]', function(){

    beforeEach(function(done){
        loadFixtures(server, done);
    });


    it('should count the documents', function(done) {
        request(server.app)
            .get('/api/1/generic/i/count')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                expect(res.body.results).to.be.equal(10);
                done();
            });
    });

    it('should count the documents with a query', function(done) {
        request(server.app)
            .get('/api/1/generic/i/count?boolean=true')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                expect(res.body.results).to.be.equal(5);
                done();
            });
    });

    it('should return an error if a field in query is not specified in schema', function(done){
        request(server.app)
            .get('/api/1/generic/i/count?unknwonField=3')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err.status).to.equal(400);
                expect(res.body.status).to.be.equal(400);
                expect(res.body.error).to.be.equal('bad request');
                expect(res.body.infos.issue).to.be.equal('bad query');
                done();
            });
    });
});