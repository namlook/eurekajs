/* eslint-env node, mocha */
/* eslint no-unused-expressions:0 */

import request from 'supertest';
import chai from 'chai';
chai.use(require('chai-http'));
chai.config.includeStack = true;
var expect = chai.expect;

import server from '../server';
import loadFixtures from '../utils/load-fixtures';

describe('Route: [find]', function(){

    beforeEach(function(done){
        loadFixtures(server, done);
    });


    it('should return all documents', function(done){
        request(server.app)
            .get('/api/1/generic')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                expect(res.body.results).to.be.instanceof(Array);
                expect(res.body.results.length).to.be.equal(10);
                done();
            });
    });

    it('should return a document by its id', function(done){
        var documentId = 'generic1';
        var date = new Date(1984, 7, 1);
        request(server.app)
            .get('/api/1/generic/' + documentId)
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                expect(res.body.results).to.be.instanceof(Object);

                var doc = res.body.results;
                expect(doc.text).to.be.equal('hello world 1');
                expect(doc.boolean).to.be.true;
                expect(doc.integer).to.be.equal(1);
                expect(doc.float).to.be.equal(1.14);
                expect(new Date(doc.date).getTime()).to.be.equal(date.getTime());

                done();
            });
    });

    it('should return 404 if no document is found', function(done){
        request(server.app)
            .get('/api/1/generic/arf')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err.status).to.equal(404);
                expect(res.body.status).to.equal(404);
                done();
            });
    });

    it('should sort the documents', function(done){
        request(server.app)
            .get('/api/1/generic?_sortBy=-integer')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                var results = res.body.results;
                expect(results).to.be.instanceof(Array);
                expect(results.length).to.be.equal(10);
                expect(results.map((o) => {
                    return o.integer;
                })).to.deep.equal([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
                done();
            });
    });

    it('should limit the documents', function(done){
        request(server.app)
            .get('/api/1/generic?_limit=5')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                var results = res.body.results;
                expect(results).to.be.instanceof(Array);
                expect(results.length).to.be.equal(5);
                done();
            });
    });

    it('should return only the specified fields', function(done){
        request(server.app)
            .get('/api/1/generic?_fields=integer,text')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                var results = res.body.results;
                expect(results).to.be.instanceof(Array);
                results.forEach(function(item) {
                    expect(item).to.have.all.keys('integer', 'text', '_class', '_id', '_uri', '_type', '_ref');
                });
                done();
            });
    });

    it('should populate all fields', function(done){
        request(server.app)
            .get('/api/1/generic?_populate=1')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                var results = res.body.results;
                expect(results).to.be.instanceof(Array);
                results.forEach(function(item) {
                    expect(item.relation.text).to.be.match(/relation/);
                });
                done();
            });
    });

    it('should populate a specified field', function(done){
        request(server.app)
            .get('/api/1/generic?_populate=relation')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                var results = res.body.results;
                expect(results).to.be.instanceof(Array);
                results.forEach(function(item) {
                    expect(item.relation.text).to.be.match(/relation/);
                });
                done();
            });
    });

    it('should allow $in operator', function(done){
        request(server.app)
            .get('/api/1/generic?integer[$in]=2,4,6')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                var results = res.body.results;
                expect(results).to.be.instanceof(Array);
                expect(results.length).to.be.equal(3);
                results.forEach(function(item) {
                    expect(item.integer).to.satisfy((num) => [2, 4, 6].indexOf(num) > -1);
                });
                done();
            });
    });

    it('should query relations', function(done){
        request(server.app)
            .get('/api/1/generic?relation.text=relation 1')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                var results = res.body.results;
                expect(results).to.be.instanceof(Array);
                expect(results.length).to.be.equal(5);
                results.forEach(function(item) {
                    expect(item.integer).to.satisfy((num) => [1, 3, 7, 5, 9].indexOf(num) > -1);
                });
                done();
            });
    });

    it('should return an error if a field in query is not specified in schema', function(done){
        request(server.app)
            .get('/api/1/generic?unknwonField=3')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err.status).to.equal(400);
                expect(res.body.status).to.be.equal(400);
                expect(res.body.error).to.be.equal('bad request');
                expect(res.body.infos.issue).to.be.equal('bad query');
                done();
            });
    });

    it('should return an error when query with a bad operator', function(done){
        request(server.app)
            .get('/api/1/generic?integer[$arf]=3')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err.status).to.equal(400);
                expect(res.body.status).to.be.equal(400);
                expect(res.body.error).to.be.equal('bad request');
                expect(res.body.infos.issue).to.be.equal('bad query');
                expect(res.body.infos.reasons[0]).to.equal('unknown operator $arf');
                done();
            });
    });

    it('should return an error when query with a bad type', function(done){
        request(server.app)
            .get('/api/1/generic?integer=bla&boolean=arf')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err.status).to.equal(400);
                expect(res.body.status).to.be.equal(400);
                expect(res.body.error).to.be.equal('bad request');
                expect(res.body.infos.issue).to.be.equal('bad query');
                expect(res.body.infos.reasons).to.deep.equal([
                    '"integer" must be a number',
                    '"boolean" must be a boolean'
                ]);
                done();
            });
    });

    it('should return an error when query with a bad relation type', function(done){
        request(server.app)
            .get('/api/1/generic?relation.related=bla')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err.status).to.equal(400);
                expect(res.body.status).to.be.equal(400);
                expect(res.body.error).to.be.equal('bad request');
                expect(res.body.infos.issue).to.be.equal('bad query');
                expect(res.body.infos.reasons).to.deep.equal(['"related" must be a boolean']);
                done();
            });
    });

    it('should return an error when specified a bad field', function(done){
        request(server.app)
            .get('/api/1/generic?_fields=boolean,integ')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err.status).to.equal(400);
                expect(res.body.status).to.be.equal(400);
                expect(res.body.error).to.be.equal('bad request');
                expect(res.body.infos.issue).to.be.equal('bad query');
                expect(res.body.infos.reasons).to.deep.equal(["unknown property 'integ' in _fields"]);
                done();
            });
    });

    it('should return an error when specified a bad sortBy', function(done){
        request(server.app)
            .get('/api/1/generic?_sortBy=boolean,integ')
            .set('Accept', 'application/json')
            .end(function(err, res){
                expect(err.status).to.equal(400);
                expect(res.body.status).to.be.equal(400);
                expect(res.body.error).to.be.equal('bad request');
                expect(res.body.infos.issue).to.be.equal('bad query');
                expect(res.body.infos.reasons).to.deep.equal(["unknown property 'integ' in _sortBy"]);
                done();
            });
    });

});