
var request = require('supertest');

var chai = require('chai');
chai.config.includeStack = true;
var expect = chai.expect;


var server = require('./server');


describe('Delete literal', function(){

    beforeEach(function(done){
        server.db.clear(function(err) {
            if (err) {
                throw err;
            }
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

            request(server.app)
                .post('/api/1/literal')
                .send({payload: JSON.stringify(literals)})
                .expect(200)
                .end(function(){
                    done();
                });
        });
    });


    it('should delete a document by its id', function(done){

        // creating the document
        request(server.app)
            .post('/api/1/literal')
            .send({payload: JSON.stringify({string: 'hello world'})})
            .expect(200)
            .end(function(err, res){
                expect(err).to.be.null;

                var documentID = res.body.object._id;
                expect(documentID).to.be.not.null;


                // check if the document has been created
                request(server.app)
                    .get('/api/1/literal/'+documentID)
                    .set('Accept', 'application/json')
                    .expect(200)
                    .end(function(err, res){
                        expect(err).to.be.null;
                        expect(res.body.results).to.be.instanceof(Array);
                        expect(res.body.results.length).to.be.equal(1);

                        // deleting the document
                        request(server.app)
                            .del('/api/1/literal/'+documentID)
                            .expect(200)
                            .end(function(err, res){
                                expect(err).to.be.null;

                                expect(res.body.status).to.be.equal('ok');

                                // check that the document has been really deleted
                                request(server.app)
                                    .get('/api/1/literal')
                                    .set('Accept', 'application/json')
                                    .expect(200)
                                    .end(function(err, res){
                                        expect(err).to.be.null;
                                        expect(res.body.results).to.be.instanceof(Array);
                                        expect(res.body.results.length).to.be.equal(10);
                                        var ids = res.body.results.map(function(item){
                                            return item._id;
                                        });
                                        expect(ids).to.not.include.members([documentID]);
                                        done();
                                    });
                            });
                    });
            });
    });
});