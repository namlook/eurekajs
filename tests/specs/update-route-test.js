
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

            var generic3 = response.result.results;
            expect(generic3._id).to.equal('generic3');

            var newGeneric3 = _.clone(generic3);
            newGeneric3.text = 'yes baby';
            newGeneric3.integer = 42;

            let postOptions = {
                method: 'POST',
                url: `/api/1/generic/generic3`,
                payload: newGeneric3
            };

            server.inject(postOptions, function(postResponse) {
                expect(postResponse.statusCode).to.equal(200);
                expect(postResponse.result.statusCode).to.equal(200);

                let data = postResponse.result.results;
                expect(data._id).to.equal('generic3');
                expect(data.text).to.equal(newGeneric3.text);
                expect(data.boolean).to.equal(generic3.boolean);
                expect(data.integer).to.equal(42);
                expect(data.float).to.equal(generic3.float);
                expect(data.date.toString()).to.equal(generic3.date.toString());

                done();
            });
        });
    });


    it('should throw an error if the payload specify unknown properties', function(done) {
            let options = {
                method: 'POST',
                url: `/api/1/generic/generic3`,
                payload: {
                    whatever: 'payload'
                }
            };

            server.inject(options, function(response) {
                expect(response.statusCode).to.equal(400);
                expect(response.result.statusCode).to.equal(400);
                expect(response.result.error).to.equal('Bad Request');
                expect(response.result.message).to.equal('"whatever" is not allowed');
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
                expect(response.result.statusCode).to.equal(404);
                done();
            });
    });

});