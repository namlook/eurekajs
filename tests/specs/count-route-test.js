/* eslint-env node, mocha */
/* eslint no-unused-expressions:0 */

import request from 'supertest';
import chai from 'chai';
chai.use(require('chai-http'));
chai.config.includeStack = true;
var expect = chai.expect;

import server from '../server';


describe('Route: [count]', function(){

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
});