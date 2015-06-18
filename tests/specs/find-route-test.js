
import Lab from 'lab';
var lab = exports.lab = Lab.script();

import Code from 'code';
var describe = lab.describe;
var it = lab.it;
var beforeEach = lab.beforeEach;
var expect = Code.expect;

import manifest from '../app/manifest';
import Glue from 'glue';

import loadFixtures from '../utils/load-fixtures';

Glue.compose(manifest, function(err, server) {
    expect(err).to.be.null();

    describe('Route [find]', function() {


        beforeEach(function(done){
            loadFixtures(server, done);
        });


        it('should return all documents', function(done){
            let options = {
                method: 'GET',
                url: '/api/1/generic'
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);

                var data = response.result.results;
                expect(data).to.be.an.array();
                expect(data.length).to.be.equal(10);

                done();
            });
        });

        it('should return a document by its id', function(done){
            var documentId = 'generic1';
            var date = new Date(1984, 7, 1);

            let options = {
                method: 'GET',
                url: `/api/1/generic/${documentId}`
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);

                let result = response.result;
                expect(result.results).to.be.an.object();
                let doc = result.results;

                expect(doc.text).to.equal('hello world 1');
                expect(doc.boolean).to.be.true();
                expect(doc.integer).to.equal(1);
                expect(doc.float).to.equal(1.14);
                expect(new Date(doc.date).getTime()).to.equal(date.getTime());
                done();
            });
        });


        it('should return 404 if no document is found', function(done){
            let options = {
                method: 'GET',
                url: `/api/1/generic/arf`
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(404);
                expect(response.result.statusCode).to.equal(404);
                done();
            });
        });


        it('should sort the documents', function(done){

            let options = {
                method: 'GET',
                url: `/api/1/generic?sortBy=-integer`
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);

                let data = response.result.results;
                expect(data).to.be.an.array();
                expect(data.length).to.be.equal(10);
                expect(data.map((o) => {
                    return o.integer;
                })).to.deep.equal([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
                done();
            });
        });

        it('should limit the documents', function(done){

            let options = {
                method: 'GET',
                url: `/api/1/generic?limit=5`
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);

                let data = response.result.results;
                expect(data).to.be.an.array();
                expect(data.length).to.be.equal(5);
                done();
            });
        });

        it('should return only the specified fields', function(done){
            let options = {
                method: 'GET',
                url: `/api/1/generic?fields=["integer","text"]`
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);

                let data = response.result.results;
                expect(data).to.be.an.array();
                data.forEach(function(item) {
                    expect(item).to.only.include(['integer', 'text', '_class', '_id', '_uri', '_type', '_ref']);
                });
                done();
            });
        });

        it('should populate all fields', function(done){

            // TODO: replace by include

            let options = {
                method: 'GET',
                url: `/api/1/generic?populate=1`
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);

                var data = response.result.results;
                expect(data).to.be.an.array();
                data.forEach(function(item) {
                    expect(item.relation.text).to.be.match(/relation/);
                });
                done();
            });
        });


        it.skip('should include a specified field', function(done){

            let options = {
                method: 'GET',
                url: `/api/1/generic?include=relation`
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);

                var data = response.result.results;
                expect(data).to.be.an.array();
                data.forEach(function(item) {
                    expect(item.relation.text).to.be.match(/relation/);
                });

                done();
            });
        });

        it('should allow $in operator', function(done){

            let options = {
                method: 'GET',
                url: `/api/1/generic?filter[integer][$in]=[2,4,6]`
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);

                var data = response.result.results;
                expect(data).to.be.an.array();
                expect(data.length).to.be.equal(3);
                data.forEach(function(item) {
                    expect(item.integer).to.satisfy((num) => [2, 4, 6].indexOf(num) > -1);
                });

                done();
            });
        });


        it('should query relations', function(done){

            let options = {
                method: 'GET',
                url: `/api/1/generic?filter[relation.text]=relation 1`
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);
                expect(response.result.statusCode).to.equal(200);

                var data = response.result.results;
                expect(data).to.be.an.array();
                expect(data.length).to.be.equal(5);
                data.forEach(function(item) {
                    expect(item.integer).to.satisfy((num) => [1, 3, 7, 5, 9].indexOf(num) > -1);
                });

                done();
            });
        });


        it('should return an error if a field in query is not specified in schema', function(done){

            let options = {
                method: 'GET',
                url: `/api/1/generic?filter[unknwonField]=3`
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(400);
                expect(response.result.statusCode).to.equal(400);

                expect(response.result.error).to.equal('Bad Request');
                expect(response.result.message).to.equal('unknown property unknwonField for model Generic');

                done();
            });
        });



        it('should return an error when query with a bad operator', function(done){

            let options = {
                method: 'GET',
                url: `/api/1/generic?filter[integer][$arf]=3`
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(400);
                expect(response.result.statusCode).to.equal(400);

                expect(response.result.error).to.equal('Bad Request');
                expect(response.result.message).to.equal('unknown operator $arf');

                done();
            });
        });

        it('should return an error when query with a bad type', function(done){

            let options = {
                method: 'GET',
                url: `/api/1/generic?filter[integer]=bla&filter[boolean]=arf`
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(400);
                expect(response.result.statusCode).to.equal(400);

                expect(response.result.error).to.equal('Bad Request');
                expect(response.result.message).to.equal('"integer" must be a number');

                done();
            });
        });

        it('should return an error when query with a bad relation type', function(done){

            let options = {
                method: 'GET',
                url: `/api/1/generic?filter[relation.related]=bla`
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(400);
                expect(response.result.statusCode).to.equal(400);

                expect(response.result.error).to.equal('Bad Request');
                expect(response.result.message).to.equal('"related" must be a boolean');

                done();
            });

        });

        it('should return an error when specified a bad field', function(done){

            let options = {
                method: 'GET',
                url: `/api/1/generic?fields=["boolean","integ"]`
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(400);
                expect(response.result.statusCode).to.equal(400);

                expect(response.result.error).to.equal('Bad Request');
                expect(response.result.message).to.equal('fields: unknown property integ for model Generic');

                done();
            });

        });


        it('should return an error when specified a bad sortBy', function(done){

            let options = {
                method: 'GET',
                url: `/api/1/generic?sortBy=boolean,integ`
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(400);
                expect(response.result.statusCode).to.equal(400);

                expect(response.result.error).to.equal('Bad Request');
                expect(response.result.message).to.equal('sortBy: unknown property integ for model Generic');

                done();
            });

        });


    });

});






