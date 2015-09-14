
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

import _ from 'lodash';

describe('Route [update]', function() {

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
            done();
        }).catch((error) => {
            console.log(error);
        });
    });


    it('should update a document', function(done){
        let options = {
            method: 'GET',
            url: '/api/1/generic/generic3'
        };
        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(200);
            var generic3 = response.result.data;
            expect(generic3.id).to.equal('generic3');

            var newGeneric3 = _.clone(generic3);
            newGeneric3.attributes.text = 'yes baby';
            newGeneric3.attributes.integer = 42;

            let postOptions = {
                method: 'PATCH',
                url: `/api/1/generic/generic3`,
                payload: {data: newGeneric3}
            };

            server.inject(postOptions, function(postResponse) {
                expect(postResponse.statusCode).to.equal(200);
                let data = postResponse.result.data;
                expect(data.id).to.equal('generic3');
                expect(data.attributes.text).to.equal(newGeneric3.attributes.text);
                expect(data.attributes.boolean).to.equal(generic3.attributes.boolean);
                expect(data.attributes.integer).to.equal(42);
                expect(data.attributes.float).to.equal(generic3.attributes.float);
                expect(data.attributes.date.toString()).to.equal(generic3.attributes.date.toString());

                done();
            });
        });
    });


    it('should throw an error when passing bad payload', function(done) {
            let options = {
                method: 'PATCH',
                url: `/api/1/generic/generic3`,
                payload: {
                    whatever: 'payload'
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(400);

                let error = response.result.errors[0];
                expect(error.status).to.equal(400);
                expect(error.title).to.equal('Bad Request');
                expect(error.detail).to.equal('malformed payload');

                done();
            });
    });


    it('should throw an error when updating an unknown property', function(done) {
            let options = {
                method: 'PATCH',
                url: `/api/1/generic/generic3`,
                payload: {
                    data: {
                        id: 'generic3',
                        type: 'Generic',
                        attributes: {
                            unknownProperty: 'arf'
                        }
                    }
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(400);

                let error = response.result.errors[0];
                expect(error.status).to.equal(400);
                expect(error.title).to.equal('Bad Request');
                expect(error.detail).to.equal('ValidationError: unknown property \"unknownProperty\" on model \"Generic\"');
                done();
            });
    });


    it('should throw a 404 error if the document to update does not exist', function(done) {
            let options = {
                method: 'POST',
                url: `/api/1/generic/generic12`,
                payload: {
                    whatever: 'payload'
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(404);
                done();
            });
    });

});