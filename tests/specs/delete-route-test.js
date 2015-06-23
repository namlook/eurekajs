
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

describe('Route [delete]', function() {

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
        fixtures.clear(server, function() {
            fixtures.genericDocuments(server, done);
        });
    });


    it('should delete a document', function(done) {

       let getOptions = {
            method: 'GET',
            url: `/api/1/generic/generic3`
        };

        server.inject(getOptions, function(getResponse) {
            expect(getResponse.statusCode).to.equal(200);
            expect(getResponse.result.statusCode).to.equal(200);

            let data = getResponse.result.results;
            expect(data._id).to.be.equal('generic3');


           let deleteOptions = {
                method: 'DELETE',
                url: `/api/1/generic/generic3`
            };

            server.inject(deleteOptions, function(deleteResponse) {
                expect(deleteResponse.statusCode).to.equal(204);

               let getOptions2 = {
                    method: 'GET',
                    url: `/api/1/generic/generic3`
                };

                server.inject(getOptions2, function(getResponse2) {
                    expect(getResponse2.statusCode).to.equal(404);
                    expect(getResponse2.result.statusCode).to.equal(404);
                    done();
                });
            });
        });
    });


    it('should throw an error if the document is not in the database', function(done) {

       let deleteOptions = {
            method: 'DELETE',
            url: `/api/1/generic/generic3`
        };

        server.inject(deleteOptions, function(deleteResponse) {
            expect(deleteResponse.statusCode).to.equal(204);


           let deleteOptions2 = {
                method: 'DELETE',
                url: `/api/1/generic/generic3`
            };

            server.inject(deleteOptions2, function(deleteResponse2) {
                expect(deleteResponse2.statusCode).to.equal(404);

                done();
            });
        });
    });



    it('should delete cascade relations of the documents', function(done) {

       let deleteOptions = {
            method: 'DELETE',
            url: `/api/1/generic/generic3`
        };

        server.inject(deleteOptions, function(getResponse) {
            expect(getResponse.statusCode).to.equal(204);

           let getRel0Options = {
                method: 'GET',
                url: `/api/1/generic-relation/relation0`
            };

            server.inject(getRel0Options, function(getRel0Response) {
                expect(getRel0Response.statusCode).to.equal(200);

                let doc = getRel0Response.result.results;
                expect(doc._id).to.equal('relation0');

               let getRel1Options = {
                    method: 'GET',
                    url: `/api/1/generic-relation/generic1`
                };

                server.inject(getRel1Options, function(getRel1Response) {
                    expect(getRel1Response.statusCode).to.equal(404);
                    expect(getRel1Response.result.statusCode).to.equal(404);
                    done();
                });
            });
        });
    });
});