
var request = require('supertest');

var chai = require('chai');
chai.config.includeStack = true;
var expect = chai.expect;


var server = require('./server');
var Eureka = require('../js');

var newServer;

describe('Curstom routes', function(){
    'use strict';

    before(function(done){
        server.db.clear(function(err) {
            if (err) {
                throw err;
            }
            done();
        });
        var configServer = server.config;
        configServer.customRoutes = [
            {
                method: 'get', url: '/literal/:id', func: function(req, res){
                    return res.json({hello: req.params.id});
                }
            },
            {
                method: 'get', url: '/literal/count', func: function(req, res){
                    req.db.count(function(err, total){
                        return res.json({newTotal: total+10});
                    });
                }
            }
        ];
        newServer = new Eureka(configServer);
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
                        expect(err).to.be.null

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
});