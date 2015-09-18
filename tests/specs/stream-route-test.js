
import Lab from 'lab';
var lab = exports.lab = Lab.script();

import Code from 'code';
var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var beforeEach = lab.beforeEach;
var expect = Code.expect;

import eureka from '../../lib';
import config from '../config';
import fixtures from '../utils/fixtures';

describe('Route [stream]', function() {

    /** load the server **/
    var server;
    before(function(done) {
        eureka(config).compose(function(err, s) {
            expect(err).to.not.exists();
            server = s;
            done();
        });
    });


     /** load the fixtures **/
    beforeEach(function(done){
        fixtures.clear(server).then(() => {
            return fixtures.genericDocuments(server);
        }).then(() => {
            return fixtures.userDocuments(server);
        }).then(() => {
            done();
        }).catch((error) => {
            console.log(error);
        });
    });

    it('should return all documents', function(done){
        let options = {
            method: 'GET',
            url: '/api/1/generic/i/stream/json'
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(200);

            let results = JSON.parse(response.result);
            var data = results.data;

            expect(data).to.be.an.array();
            expect(data.length).to.be.equal(10);
            expect(data[0].id).to.equal('generic1');
            expect(data[0].type).to.equal('Generic');
            expect(data[0].attributes).to.be.an.object();
            expect(data[0].relationships).to.be.an.object();

            expect(results.links.self).to.equal('/api/1/generic');
            done();
        });
    });


    it('should filter documents', function(done){
        let options = {
            method: 'GET',
            url: '/api/1/generic/i/stream/json?filter[integer]=9'
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(200);

            let results = JSON.parse(response.result);
            var data = results.data;

            expect(data).to.be.an.array();
            expect(data.length).to.be.equal(1);
            expect(data[0].id).to.equal('generic9');
            expect(data[0].attributes.integer).to.equal(9);

            expect(results.links.self).to.equal('/api/1/generic');
            done();
        });
    });


    it('should throw a 400 error if the format is unknown', function(done){
        let options = {
            method: 'GET',
            url: '/api/1/generic/i/stream/arf'
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(400);

            let error = response.result.errors[0];
            expect(error.status).to.equal(400);
            expect(error.title).to.equal('Bad Request');
            expect(error.detail).to.equal('child "format" fails because ["format" must be one of [json, csv, tsv]]');

            done();
        });
    });

    it('should throw a 403 error if the include option is passed', function(done){
        let options = {
            method: 'GET',
            url: '/api/1/generic/i/stream/json?include=relation'
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(403);

            let error = response.result.errors[0];
            expect(error.status).to.equal(403);
            expect(error.title).to.equal('Forbidden');
            expect(error.detail).to.equal("stream doesn't support include option");

            done();
        });
    });


});