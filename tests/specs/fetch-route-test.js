
import Lab from 'lab';
var lab = exports.lab = Lab.script();

import Code from 'code';
var describe = lab.describe;
var it = lab.it;
var beforeEach = lab.beforeEach;
var expect = Code.expect;

import eureka from '../../lib';
import config from '../config';
import fixtures from '../utils/fixtures';


describe('Route [fetch]', function() {

    /** load the server **/
    var server;
    lab.before(function(done) {
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
            expect(result.data).to.be.an.object();
            let doc = result.data;

            expect(doc.attributes.text).to.equal('hello world 1');
            expect(doc.attributes.boolean).to.be.true();
            expect(doc.attributes.integer).to.equal(1);
            expect(doc.attributes.float).to.equal(1.14);
            expect(new Date(doc.attributes.date).getTime()).to.equal(date.getTime());
            done();
        });
    });

    it('should return the on-to-one relationships references', function(done){

        let options = {
            method: 'GET',
            url: '/api/1/generic/generic1/relationships/relation'
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(200);

            let result = response.result;
            expect(result.data).to.be.an.object();
            expect(result.data.id).to.equal('relation1');
            expect(result.data.type).to.equal('GenericRelation');
            expect(result.links.self).to.endWith('/api/1/generic/generic1/relationships/relation');
            expect(result.links.related).to.endWith('/api/1/generic/generic1/relation');
            done();
        });
    });


    it('should return the on-to-many relationships references', function(done){

        let options = {
            method: 'GET',
            url: '/api/1/generic/generic1/relationships/relations'
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(200);

            let result = response.result;
            expect(result.data).to.be.an.array();
            expect(result.data).to.deep.equal([
                {
                  'id': 'relation0',
                  'type': 'GenericRelation'
                },
                {
                  'id': 'relation1',
                  'type': 'GenericRelation'
                },
                {
                  'id': 'relation2',
                  'type': 'GenericRelation'
                }
            ]);

            expect(result.links.self).to.endWith('/api/1/generic/generic1/relationships/relations');
            expect(result.links.related).to.endWith('/api/1/generic/generic1/relations');
            done();
        });
    });


    it('should redirect the on-to-one relationships', function(done){

        let options = {
            method: 'GET',
            url: '/api/1/generic/generic1/relation'
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(302);
            expect(response.headers.location).to.equal('/api/1/generic-relation/relation1');
            done();
        });
    });

    it('should redirect the on-to-many relationships', function(done){

        let options = {
            method: 'GET',
            url: '/api/1/generic/generic1/relations'
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(302);
            expect(response.headers.location).to.equal('/api/1/generic-relation?filter%5BgenericsRelations._id%5D=generic1');
            done();
        });
    });

    it('should throw a 404 error if the relation is unknown', function(done){

        let options = {
            method: 'GET',
            url: '/api/1/generic/generic1/unknownRelation'
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(404);

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

            let error = response.result.errors[0];
            expect(error.status).to.equal(404);
            expect(error.title).to.equal('Not Found');
            done();
        });
    });

    it('should throw a 404 error if the relationships is unknown', function(done){

        let options = {
            method: 'GET',
            url: '/api/1/generic/generic1/relationships/unknownRelation'
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(404);

            done();
        });
    });

});