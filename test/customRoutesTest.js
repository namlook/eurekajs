
var request = require('supertest');

var chai = require('chai');
chai.config.includeStack = true;
var expect = chai.expect;


var server = require('./server');
var Eureka = require('../js');

var newServer;

describe('Curstom routes', function(){
    'use strict';

    beforeEach(function(done){
        server.db.clear(function(err) {
            if (err) {
                throw err;
            }

            var configServer = server.config;
            configServer.customRoutes = [
                {
                    method: 'get', url: '/literal/:id', func: function(req, res) {
                        return res.json({hello: req.params.id});
                    }
                },
                {
                    method: 'get', url: '/literal/count', func: function(req, res) {
                        req.db.count({_type: 'Literal'}, function(err, total){
                            return res.json({newTotal: total+10});
                        });
                    }
                },
                {
                    method: 'delete', url: '/:type/:id', func: function(req, res) {
                        return res.json({deleted: 'actually not at all'});
                    }
                }
            ];
            newServer = new Eureka(configServer);
            done();
        });
    });


    it('should fire the custom route', function(done){

        // test custom route count
        request(newServer.app)
            .get('/api/1/literal/count')
            .set('Accept', 'application/json')
            .expect(200)
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res.body.newTotal).to.be.equal(10);

                // add a document
                request(server.app)
                    .post('/api/1/literal')
                    .expect('Content-Type', /json/)
                    .send({payload: JSON.stringify({
                        string: "hello world",
                        boolean: true,
                        integer: 42,
                        float: 3.14,
                        date: new Date(1984, 7, 3)

                    })})
                    .expect(200)
                    .end(function(err, res) {
                        expect(err).to.be.null;

                        var documentID = res.body.object._id;
                        expect(documentID).to.be.not.null;

                        // test custom route get
                        request(newServer.app)
                            .get('/api/1/literal/'+documentID)
                            .set('Accept', 'application/json')
                            .expect(200)
                            .end(function(err, res){
                                expect(err).to.be.null;
                                expect(res.body.hello).to.be.equal(documentID);


                                // re-test custom route count
                                request(newServer.app)
                                    .get('/api/1/literal/count')
                                    .set('Accept', 'application/json')
                                    .expect(200)
                                    .end(function(err, res){
                                        expect(err).to.be.null;
                                        expect(res.body.newTotal).to.be.equal(11);

                                        done();
                                    });
                            });
                    });
            });
    });

    it('overwrite generic routes', function(done){

        // add a document
        request(newServer.app)
            .post('/api/1/literal')
            .expect('Content-Type', /json/)
            .send({payload: JSON.stringify({
                string: "hello world",
                boolean: true,
                integer: 42,
                float: 3.14,
                date: new Date(1984, 7, 3)

            })})
            .expect(200)
            .end(function(err, res) {
                expect(err).to.be.null;

                var documentID = res.body.object._id;
                expect(documentID).to.be.not.null;

                // deleting the document
                request(newServer.app)
                    .del('/api/1/literal/'+documentID)
                    .expect(200)
                    .end(function(err, res){
                        expect(err).to.be.null;

                        expect(res.body.deleted).to.be.equal('actually not at all');

                        // count: the document shouldn't be deleted
                        request(newServer.app)
                            .get('/api/1/literal/count')
                            .set('Accept', 'application/json')
                            .expect(200)
                            .end(function(err, res){
                                expect(err).to.be.null;
                                expect(res.body.newTotal).to.be.equal(11);
                                done();
                            });
                    });
            });

    });
});