/* eslint-env node, mocha */
/* eslint no-unused-expressions:0 */

import request from 'supertest';
import chai from 'chai';
chai.config.includeStack = true;
var expect = chai.expect;

import server from '../server';


describe('Route: [find]', function(){

    beforeEach(function(done){
        server.database.clear(function(err) {
            if (err) {
                throw err;
            }

            var relations = [
                {
                    _id: 'relation0',
                    _type: 'GenericRelation',
                    text: 'relation 0',
                    arf: 'bla'
                },
                {
                    _id: 'relation1',
                    _type: 'GenericRelation',
                    text: 'relation 1',
                    arf: 'ble'
                }
            ];

            var generics = [];
            for (var i = 1; i < 11; i++) {
                generics.push({
                    _id: `generic${i}`,
                    _type: 'Generic',
                    text: `hello world ${i}`,
                    boolean: i % 2,
                    integer: i,
                    float: i + 0.14,
                    date: new Date(1984, 7, i),
                    relation: {_id: relations[i % 2]._id, _type: 'GenericRelation'}
                });
            }

            relations = relations.map(function(pojo) {
                return new server.database.GenericRelation(pojo).toSerializableObject();
            });

            generics = generics.map(function(pojo) {
                return new server.database.Generic(pojo).toSerializableObject();
            });


            server.database.batchSync(relations, function(err1) {
                expect(err1).to.be.null;
                server.database.batchSync(generics, function(err2) {
                    expect(err2).to.be.null;
                    done();
                });
            });
        });
    });


    it('sould return all documents', function(done){
        request(server.app)
            .get('/api/1/generic')
            .set('Accept', 'application/json')
            .expect(200)
            .end(function(err, res){
                expect(err).to.be.null;
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
            .expect(200)
            .end(function(err, res){
                expect(err).to.be.null;
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

    it('sould sort the documents', function(done){
        request(server.app)
            .get('/api/1/generic?_sortBy=-integer')
            .set('Accept', 'application/json')
            .expect(200)
            .end(function(err, res){
                expect(err).to.be.null;
                var results = res.body.results;
                expect(results).to.be.instanceof(Array);
                expect(results.length).to.be.equal(10);
                expect(results.map((o) => {
                    return o.integer;
                })).to.deep.equal([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
                done();
            });
    });

    it('sould limit the documents', function(done){
        request(server.app)
            .get('/api/1/generic?_limit=5')
            .set('Accept', 'application/json')
            .expect(200)
            .end(function(err, res){
                expect(err).to.be.null;
                var results = res.body.results;
                expect(results).to.be.instanceof(Array);
                expect(results.length).to.be.equal(5);
                done();
            });
    });

    it('sould return only the specified fields', function(done){
        request(server.app)
            .get('/api/1/generic?_fields=integer,text')
            .set('Accept', 'application/json')
            .expect(200)
            .end(function(err, res){
                expect(err).to.be.null;
                var results = res.body.results;
                expect(results).to.be.instanceof(Array);
                results.forEach(function(item) {
                    expect(item).to.have.all.keys('integer', 'text', '_class', '_id', '_uri', '_type', '_ref');
                });
                done();
            });
    });

    it('sould populate all fields', function(done){
        request(server.app)
            .get('/api/1/generic?_populate=1')
            .set('Accept', 'application/json')
            .expect(200)
            .end(function(err, res){
                expect(err).to.be.null;
                var results = res.body.results;
                expect(results).to.be.instanceof(Array);
                results.forEach(function(item) {
                    expect(item.relation.text).to.be.match(/relation/);
                });
                done();
            });
    });

    it('sould populate a specified field', function(done){
        request(server.app)
            .get('/api/1/generic?_populate=relation')
            .set('Accept', 'application/json')
            .expect(200)
            .end(function(err, res){
                expect(err).to.be.null;
                var results = res.body.results;
                expect(results).to.be.instanceof(Array);
                results.forEach(function(item) {
                    expect(item.relation.text).to.be.match(/relation/);
                });
                done();
            });
    });

    it('sould allow $in operator', function(done){
        request(server.app)
            .get('/api/1/generic?integer[$in]=2,4,6')
            .set('Accept', 'application/json')
            .expect(200)
            .end(function(err, res){
                expect(err).to.be.null;
                var results = res.body.results;
                expect(results).to.be.instanceof(Array);
                expect(results.length).to.be.equal(3);
                results.forEach(function(item) {
                    expect(item.integer).to.satisfy((num) => [2, 4, 6].indexOf(num) > -1);
                });
                done();
            });
    });

    it('sould query relations', function(done){
        request(server.app)
            .get('/api/1/generic?relation.text=relation 1')
            .set('Accept', 'application/json')
            .expect(200)
            .end(function(err, res){
                expect(err).to.be.null;
                var results = res.body.results;
                expect(results).to.be.instanceof(Array);
                expect(results.length).to.be.equal(5);
                results.forEach(function(item) {
                    expect(item.integer).to.satisfy((num) => [1, 3, 7, 5, 9].indexOf(num) > -1);
                });
                done();
            });
    });

});