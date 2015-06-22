
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


describe('Route [stream]', function() {

    /** load the server **/
    var server;
    lab.before(function(done) {
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


    it('should return all documents', function(done){
        let options = {
            method: 'GET',
            url: '/api/1/generic/i/stream/json'
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(200);

            var data = response.result.results;
            expect(data).to.be.an.array();
            expect(data.length).to.be.equal(10);

            done();
        });
    });

    it.only('should throw an error if the format is unknown', function(done){
        let options = {
            method: 'GET',
            url: '/api/1/generic/i/stream/arf'
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(400);
            expect(response.result.statusCode).to.equal(400);

            expect(response.result.error).to.equal('Bad Request');
            expect(response.result.message).to.equal('child "format" fails because ["format" must be one of [json, csv, tsv]]');


            done();
        });
    });

});