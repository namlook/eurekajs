/* eslint-env node, mocha */
/* eslint no-unused-expressions:0 */

import request from 'supertest';
import chai from 'chai';
chai.use(require('chai-http'));
chai.config.includeStack = true;
var expect = chai.expect;

import server from '../server';
import loadFixtures from '../utils/load-fixtures';

describe('Route: [delete]', function(){

    beforeEach(function(done){
        loadFixtures(server, done);
    });

    it('should delete a document', function(done) {
        request(server.app)
            .get('/api/1/generic/generic3')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                expect(res.body.results._id).to.be.equal('generic3');

                request(server.app)
                    .delete('/api/1/generic/generic3')
                    .set('Accept', 'application/json')
                    .end(function(err2, res2){
                        expect(err2).to.be.null;
                        expect(res2).to.have.status(204);

                        request(server.app)
                            .get('/api/1/generic/generic3')
                            .set('Accept', 'application/json')
                            .end(function(err3, res3){
                                expect(err3).to.be.not.null;
                                expect(err3.status).to.equal(404);
                                expect(res3.body.status).to.equal(404);
                                expect(res3.body.results).to.be.undefined;
                                done();
                            });
                    });
            });
    });

    it('should delete cascade relations of the documents', function(done) {

        request(server.app)
            .delete('/api/1/generic/generic3')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(204);

                request(server.app)
                    .get('/api/1/generic-relation/relation0')
                    .set('Accept', 'application/json')
                    .end(function(err2, res2){
                        expect(err2).to.be.null;
                        expect(res2.body.results._id).to.equal('relation0');

                        request(server.app)
                            .get('/api/1/generic-relation/relation1')
                            .set('Accept', 'application/json')
                            .end(function(err3, res3){
                                expect(err3).to.be.not.null;
                                expect(err3.status).to.equal(404);
                                expect(res3.body.status).to.equal(404);
                                expect(res3.body.results).to.be.undefined;
                                done();
                            });
                    });
            });
    });

    it('should delete with query?');//, function(done) {
    //     request(server.app)
    //         .delete('/api/1/generic?boolean=true')
    //         .set('Accept', 'application/json')
    //         .end(function(err, res){
    //             expect(err).to.be.null;
    //             expect(res).to.have.status(204);

    //             request(server.app)
    //                 .get('/api/1/generic?boolean=false')
    //                 .set('Accept', 'application/json')
    //                 .end(function(err2, res2){
    //                     expect(err2).to.be.null;
    //                     expect(res2.body.results.length).to.equal(5);

    //                     request(server.app)
    //                         .get('/api/1/generic?boolean=true')
    //                         .set('Accept', 'application/json')
    //                         .end(function(err3, res3){
    //                             expect(err2).to.be.null;
    //                             expect(res2.body.results.length).to.equal(0);
    //                             done();
    //                         });
    //                 });
    //         });
    // });
});