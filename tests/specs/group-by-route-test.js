/* eslint-env node, mocha */
/* eslint no-unused-expressions:0 */

import request from 'supertest';
import chai from 'chai';
chai.use(require('chai-http'));
chai.config.includeStack = true;
var expect = chai.expect;

import server from '../server';
import loadFixtures from '../utils/load-fixtures';

describe('Route: [group-by]', function(){

    beforeEach(function(done){
        loadFixtures(server, done);
    });


    it('should group by a property', function(done) {
        request(server.app)
            .get('/api/1/generic/i/group-by/boolean')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                expect(res.body.results.length).to.be.equal(2);
                expect(res.body.results).to.deep.equal([
                    {
                        'facet': '0',
                        'count': 5
                    },
                    {
                        'facet': '1',
                        'count': 5
                    }
                ]);
                done();
            });
    });


    it('should group by a relation property', function(done) {
        request(server.app)
            .get('/api/1/generic/i/group-by/relation.text')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                expect(res.body.results.length).to.be.equal(2);
                expect(res.body.results).to.deep.equal([
                    {
                        'facet': 'relation 0',
                        'count': 5
                    },
                    {
                        'facet': 'relation 1',
                        'count': 5
                    }
                ]);
                done();
            });
    });

    it('should group by a property with a query', function(done) {
        request(server.app)
            .get('/api/1/generic/i/group-by/boolean?integer[$gt]=3')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                expect(res.body.results.length).to.be.equal(2);
                expect(res.body.results).to.deep.equal([
                    {
                        'facet': '0',
                        'count': 4
                    },
                    {
                        'facet': '1',
                        'count': 3
                    }
                ]);
                done();
            });
    });
});