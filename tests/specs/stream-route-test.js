
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

import csv from 'csv';

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

    describe('JsonApi export', function() {

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

        it.skip('should limit the number of documents', function(done){
            let options = {
                method: 'GET',
                url: '/api/1/generic/i/stream/json?limit=3'
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);

                let results = JSON.parse(response.result);
                var data = results.data;

                expect(data).to.be.an.array();
                expect(data.length).to.be.equal(3);
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

        it('should only return specified fields', function(done){
            let options = {
                method: 'GET',
                url: '/api/1/generic/i/stream/json?fields=integer'
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);

                let results = JSON.parse(response.result);
                var data = results.data;

                expect(data).to.be.an.array();
                expect(data.length).to.be.equal(10);
                expect(data[0].id).to.equal('generic1');
                expect(data[0].attributes.integer).to.equal(1);
                expect(data[0].relationships).to.not.exist();
                expect(data[0].attributes.text).to.not.exist();

                expect(results.links.self).to.equal('/api/1/generic');
                done();
            });
        });
    });


    describe('CSV export', function() {

        it('should return all documents', function(done){
            let options = {
                method: 'GET',
                url: '/api/1/generic/i/stream/csv'
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);

                csv.parse(response.result, {}, (err, output) => {
                    expect(err).to.not.exist();

                    let header = output.shift();
                    expect(header).to.deep.equal([
                        '_id',
                        '_type',
                        'array',
                        'attachement',
                        'boolean',
                        'date',
                        'datetime',
                        'float',
                        'integer',
                        'relation',
                        'relations',
                        'text'
                    ]);
                    expect(output.length).to.equal(10);
                    expect(output[0]).to.deep.equal([
                        'generic1',
                        'Generic',
                        '',
                        '',
                        'true',
                        'Tue, 31 Jul 1984 22:00:00 GMT',
                        '',
                        '1.14',
                        '1',
                        'relation1',
                        'relation0|relation1|relation2',
                        'hello world 1'
                    ]);
                    done();
                });
            });
        });

        it.skip('should limit the number of documents', function(done){
            let options = {
                method: 'GET',
                url: '/api/1/generic/i/stream/csv?limit=3'
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);

                csv.parse(response.result, {}, (err, output) => {
                    expect(err).to.not.exist();

                    expect(output.length).to.equal(4); // header + content
                    done();
                });
            });
        });


        it('should allow custom delimiter', function(done){
            let options = {
                method: 'GET',
                url: '/api/1/generic/i/stream/csv?delimiter=|'
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);

                csv.parse(response.result, {delimiter: '|'}, (err, output) => {
                    expect(err).to.not.exist();

                    let header = output.shift();
                    expect(header).to.deep.equal([
                        '_id',
                        '_type',
                        'array',
                        'attachement',
                        'boolean',
                        'date',
                        'datetime',
                        'float',
                        'integer',
                        'relation',
                        'relations',
                        'text'
                    ]);
                    expect(output.length).to.equal(10);
                    expect(output[0]).to.deep.equal([
                        'generic1',
                        'Generic',
                        '',
                        '',
                        'true',
                        'Tue, 31 Jul 1984 22:00:00 GMT',
                        '',
                        '1.14',
                        '1',
                        'relation1',
                        'relation0|relation1|relation2',
                        'hello world 1'
                    ]);
                    done();
                });
            });
        });


        it('should filter documents', function(done){
            let options = {
                method: 'GET',
                url: '/api/1/generic/i/stream/csv?filter[integer]=9'
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);

                csv.parse(response.result, {}, (err, output) => {
                    expect(err).to.not.exist();
                    expect(output.length).to.equal(2); // header + content
                    expect(output[1]).to.deep.equal([
                        'generic9',
                        'Generic',
                        '',
                        '',
                        'true',
                        'Wed, 08 Aug 1984 22:00:00 GMT',
                        '',
                        '9.14',
                        '9',
                        'relation1',
                        'relation1|relation2|relation3|relation4',
                        'hello world 9'
                    ]);
                    done();
                });
            });
        });

        it('should only return specified fields', function(done){
            let options = {
                method: 'GET',
                url: '/api/1/generic/i/stream/csv?fields=integer'
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);

                csv.parse(response.result, {}, (err, output) => {
                    expect(err).to.not.exist();
                    let header = output.shift();
                    expect(header).to.deep.equal([
                        '_id',
                        '_type',
                        'integer'
                    ]);
                    expect(output.length).to.equal(10);
                    expect(output[0]).to.deep.equal([
                        'generic1',
                        'Generic',
                        '1'
                    ]);
                    done();
                });
            });
        });
    });

    describe('TSV export', function() {

        it('should return all documents', function(done){
            let options = {
                method: 'GET',
                url: '/api/1/generic/i/stream/tsv'
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(200);

                csv.parse(response.result, {delimiter: '\t'}, (err, output) => {
                    expect(err).to.not.exist();

                    let header = output.shift();
                    expect(header).to.deep.equal([
                        '_id',
                        '_type',
                        'array',
                        'attachement',
                        'boolean',
                        'date',
                        'datetime',
                        'float',
                        'integer',
                        'relation',
                        'relations',
                        'text'
                    ]);
                    expect(output.length).to.equal(10);
                    expect(output[0]).to.deep.equal([
                        'generic1',
                        'Generic',
                        '',
                        '',
                        'true',
                        'Tue, 31 Jul 1984 22:00:00 GMT',
                        '',
                        '1.14',
                        '1',
                        'relation1',
                        'relation0|relation1|relation2',
                        'hello world 1'
                    ]);
                    done();
                });
            });
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

    it('should throw a 400 error if the include option is passed', function(done){
        let options = {
            method: 'GET',
            url: '/api/1/generic/i/stream/json?include=relation'
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(400);

            let error = response.result.errors[0];
            expect(error.status).to.equal(400);
            expect(error.title).to.equal('Bad Request');
            expect(error.detail).to.equal('"include" is not allowed');

            done();
        });
    });

});