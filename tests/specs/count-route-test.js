
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

import loadFixtures from '../utils/load-fixtures';

describe('Route [count]', function() {

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
        loadFixtures(server, done);
    });


    it('should count the documents', function(done) {

        let options = {
            method: 'GET',
            url: `/api/1/generic/i/count`
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(200);
            expect(response.result.statusCode).to.equal(200);

            let data = response.result.results;
            expect(data).to.be.equal(10);
            done();
        });
    });

    it('should count the documents with a filter', function(done) {

        let options = {
            method: 'GET',
            url: `/api/1/generic/i/count?filter[boolean]=true`
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(200);
            expect(response.result.statusCode).to.equal(200);

            let data = response.result.results;
            expect(data).to.be.equal(5);
            done();
        });
    });

    it('should return an error if a field in filter is not a model property', function(done){

        let options = {
            method: 'GET',
            url: `/api/1/generic/i/count?filter[unknwonField]=3`
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(400);
            expect(response.result.statusCode).to.equal(400);

            expect(response.result.error).to.equal('Bad Request');
            expect(response.result.message).to.equal('unknown property unknwonField for model Generic');

            done();
        });
    });
});

