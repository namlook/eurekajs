/* eslint-env node, mocha */
/* eslint no-unused-expressions:0 */

import request from 'supertest';
import chai from 'chai';
chai.use(require('chai-http'));
chai.config.includeStack = true;
var expect = chai.expect;

import server from '../server';

server.mount();
var application = server.app;

describe('Route: [create]', function(){

    beforeEach(function(done){
        server.database.clear(function(err) {
            if (err) {
                throw err;
            }
            done();
        });
    });

    it('should create a document', function(done){

        var date = new Date(1984, 7, 3);

        request(application)
            .post('/api/1/generic')
            // .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .send({payload: JSON.stringify({
                text: 'hello world',
                boolean: true,
                integer: 42,
                float: 3.14,
                date: new Date(1984, 7, 3)

            })})
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);
                var results = res.body.results;
                expect(results._id).to.not.be.null;
                expect(results.text).to.be.equal('hello world');
                expect(results.boolean).to.be.true;
                expect(results.integer).to.be.equal(42);
                expect(results.float).to.be.equal(3.14);
                var fetchedDate = new Date(results.date);
                expect(fetchedDate.getTime()).to.be.equal(date.getTime());

                done();
            });
    });

    it('accept a list of document (batch)', function(done){

        var generics = [];
        for (var i = 1; i < 11; i++) {
            generics.push({
                text: `hello world ${i}`,
                boolean: i % 2,
                integer: i,
                float: i + 0.14,
                date: new Date(1984, 7, i)
            });
        }

        request(application)
            .post('/api/1/generic')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .send({payload: JSON.stringify(generics)})
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res).to.have.status(200);

                var results = res.body.results;
                expect(results).to.be.instanceof(Array);
                expect(results.length).to.be.equal(10);
                results.forEach(function(item){
                    expect(item.text).to.match(/^hello world/);
                });

                done();
            });
    });

});