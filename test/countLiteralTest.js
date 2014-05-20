
var request = require('supertest');

var chai = require('chai');
chai.config.includeStack = true;
var expect = chai.expect;


var server = require('./server');


describe('Count literal', function(){

    beforeEach(function(done){
        server.db.clear(function(err) {
            if (err) {
                throw err;
            }
            done();
        });
    });


    it('should return the number of documents', function(done){
        var literals = [];
        for (var i = 1; i < 11; i++) {
            literals.push({
                string: "hello world "+i,
                boolean: i%2,
                integer: i,
                float: i+0.14,
                date: new Date(1984, 7, i)
            });
        }

        // add 10 documents
        request(server.app)
            .post('/api/1/literal')
            .send({payload: JSON.stringify(literals)})
            .expect(200)
            .end(function(){

                // count
                request(server.app)
                    .get('/api/1/literal/count')
                    .set('Accept', 'application/json')
                    .expect(200)
                    .end(function(err, res){
                        expect(err).to.be.null;

                        expect(res.body.total).to.be.equal(10);

                        // add one more document
                        request(server.app)
                            .post('/api/1/literal')
                            .send({payload: JSON.stringify({
                                string: "hello world",
                            })})
                            .expect(200)
                            .end(function(err, res){
                                expect(err).to.be.null;

                                // re-count
                                request(server.app)
                                    .get('/api/1/literal/count')
                                    .set('Accept', 'application/json')
                                    .expect(200)
                                    .end(function(err, res){
                                        expect(err).to.be.null;
                                        expect(res.body.total).to.be.equal(11);
                                        done();
                                    });
                            });

                    });
            });
    });
});