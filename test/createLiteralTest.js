
var request = require('supertest');

var chai = require('chai');
chai.config.includeStack = true;
var expect = chai.expect;


var server = require('./server');

describe('Create literal', function(){

    beforeEach(function(done){
        server.db.clear(function(err) {
            if (err) {
                throw err;
            }
            done();
        });
    });

    it('should create a document', function(done){

        var date = new Date(1984, 7, 3);

        request(server.app)
            .post('/api/1/literal')
            // .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .send({payload: JSON.stringify({
                string: "hello world",
                boolean: true,
                integer: 42,
                float: 3.14,
                date: new Date(1984, 7, 3)

            })})
            .expect(200)

            .end(function(err, res){
                expect(err).to.be.null;

                expect(res.body.infos.dbTouched).to.be.true;

                expect(res.body.object._id).to.not.be.null;
                expect(res.body.object.string).to.be.equal('hello world');
                expect(res.body.object.boolean).to.be.true;
                expect(res.body.object.integer).to.be.equal(42);
                expect(res.body.object.float).to.be.equal(3.14);
                var fetchedDate = new Date(res.body.object.date);
                expect(fetchedDate.getTime()).to.be.equal(date.getTime());

                done();
            });
    });

    it('accept a list of document (batch)', function(done){

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
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .send({payload: JSON.stringify(literals)})
            .expect(200)

            .end(function(err, res){
                expect(err).to.be.null;

                expect(res.body).to.be.instanceof(Array);
                expect(res.body.length).to.be.equal(10);
                res.body.forEach(function(item){
                    expect(item.options.dbTouched).to.be.true;
                    expect(item.result.string).to.match(/^hello world/);
                });

                done();
            });
    });

});