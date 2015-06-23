
import Lab from 'lab';
var lab = exports.lab = Lab.script();

import Code from 'code';
var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var beforeEach = lab.beforeEach;
var expect = Code.expect;

import manifest from '../app/manifest';
import Glue from 'glue';

import fixtures from '../utils/fixtures';

describe('Route [group-by]', function() {

    /** load the server **/
    var server;
    before(function(done) {
        Glue.compose(manifest, function(err, s) {
            expect(err).to.be.null();
            server = s;
            done();
        });
    });


     /** load the fixtures **/
    beforeEach(function(done){
        fixtures.clear(server, function() {
            fixtures.genericDocuments(server, done);
        });
    });

    it('should group by a property', function(done) {
        let options = {
            method: 'GET',
            url: `/api/1/generic/i/group-by/boolean`
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(200);
            expect(response.result.statusCode).to.equal(200);

            let data = response.result.results;
            expect(data).to.be.an.array();
            expect(data.length).to.equal(2);
            expect(data).to.be.deep.equal([
                {
                    'facet': false,
                    'count': 5
                },
                {
                    'facet': true,
                    'count': 5
                }
            ]);

            done();
        });

    });


    it('should group by a relation property', function(done) {
        let options = {
            method: 'GET',
            url: `/api/1/generic/i/group-by/relation.text`
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(200);
            expect(response.result.statusCode).to.equal(200);

            let data = response.result.results;
            expect(data).to.be.an.array();
            expect(data.length).to.equal(2);
            expect(data).to.be.deep.equal([
                {
                    'facet': 'relation 0',
                    'count': 5
                },
                {
                    'facet': 'relation 1',
                    'count': 5
                }
            ]);

            done();
        });
    });

    it('should group by a property with a query', function(done) {
        let options = {
            method: 'GET',
            url: `/api/1/generic/i/group-by/boolean?filter[integer][$gt]=3`
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(200);
            expect(response.result.statusCode).to.equal(200);

            let data = response.result.results;
            expect(data).to.be.an.array();
            expect(data.length).to.equal(2);
            expect(data).to.be.deep.equal([
                {
                    'facet': false,
                    'count': 4
                },
                {
                    'facet': true,
                    'count': 3
                }
            ]);

            done();
        });
    });



    it('should throw an error if the property is not a model property', function(done) {
        let options = {
            method: 'GET',
            url: `/api/1/generic/i/group-by/unknownField`
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(400);
            expect(response.result.statusCode).to.equal(400);
            expect(response.result.error).to.equal('Bad Request');
            expect(response.result.message).to.equal('unknown property "unknownField" for model Generic');


            done();
        });

    });



    it('should throw an error if the filter contains unknown properties', function(done) {
        let options = {
            method: 'GET',
            url: '/api/1/generic/i/group-by/boolean?filter[unknownField]=3'
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(400);
            expect(response.result.statusCode).to.equal(400);
            expect(response.result.error).to.equal('Bad Request');
            expect(response.result.message).to.equal('unknown property "unknownField" for model Generic');


            done();
        });

    });
});