

var request = require('supertest');

var chai = require('chai');
chai.config.includeStack = true;
var expect = chai.expect;

var server = require('./server');


describe('Fetch literal', function(){

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


    it('should return a document by its id', function(done){

        var date = new Date(1984, 7, 3);

        // creating the document
        request(server.app)
            .post('/api/1/literal')
            .send({payload: JSON.stringify({
                string: "hello world",
                boolean: true,
                integer: 42,
                float: 3.14,
                date: date
            })})
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

                        var doc = res.body.results[0];

                        expect(doc.string).to.be.equal('hello world');
                        expect(doc.boolean).to.be.true;
                        expect(doc.integer).to.be.equal(42);
                        expect(doc.float).to.be.equal(3.14);
                        expect(new Date(doc.date).getTime()).to.be.equal(date.getTime());

                        done();
                    });
            });
    });
});