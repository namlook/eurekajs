
var request = require('supertest');

var chai = require('chai');
chai.config.includeStack = true;
var expect = chai.expect;


var server = require('./server');


describe('List literal', function(){

    before(function(done){
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


    it('respond with json', function(done){
        request(server.app)
            .get('/api/1/literal')
            .set('Accept', 'application/json')
            .expect(200)
            .end(function(err, res){
                expect(err).to.be.null;
                expect(res.body.results).to.be.instanceof(Array);
                expect(res.body.results.length).to.be.equal(10);
                done();
            });
    });
});