/* eslint-env node, mocha */
/* eslint no-unused-expressions:0 */

import request from 'supertest';
import chai from 'chai';
chai.use(require('chai-http'));
chai.config.includeStack = true;
var expect = chai.expect;

import server from '../server';
import loadFixtures from '../utils/load-fixtures';

import _ from 'lodash';

describe('Route: [update]', function(){

    beforeEach(function(done){
        loadFixtures(server, done);
    });

    it('should update a document', function(done){
        request(server.app)
            .get('/api/1/generic/generic3')
            .end(function(err, res) {
                expect(err).to.be.null;
                expect(res).to.have.status(200);

                var generic3 = res.body.results;
                expect(generic3._id).to.equal('generic3');

                var newGeneric3 = _.clone(generic3);
                newGeneric3.text = 'yes baby';
                newGeneric3.integer = 42;

                request(server.app)
                    .post('/api/1/generic/generic3')
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .send({payload: JSON.stringify(newGeneric3)})
                    .end(function(err2, res2){
                        expect(err2).to.be.null;
                        expect(res2).to.have.status(200);

                        var results = res2.body.results;
                        expect(results._id).to.not.be.null;
                        expect(results.text).to.be.equal('yes baby');
                        expect(results.boolean).to.be.true;
                        expect(results.integer).to.be.equal(42);
                        expect(results.float).to.be.equal(3.14);
                        expect(new Date(results.date).getTime()).to.be.equal(
                            new Date(generic3.date).getTime()
                        );

                        done();
                    });
            });
    });
});