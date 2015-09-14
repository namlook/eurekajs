import Lab from 'lab';
var lab = exports.lab = Lab.script();

import Code from 'code';
var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var expect = Code.expect;

import eureka from '../../lib';
import JsonApiBuilder from '../../lib/plugins/eureka/json-api-builder';
import config from '../config';
import fixtures from '../utils/fixtures';



describe('JsonApiBuilder', function() {

    var db;
    before(function(done) {
        eureka(config).compose(function(err, server) {
            expect(err).to.not.exists();
            // server = s;
            db = server.plugins.eureka.database;
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
    });

    describe('#parse()', function() {
        it('should parse a json api data into a simpler pojo', function(done) {
            let jsonApiData = {
                id: 'foo',
                type: 'Test',
                attributes: {
                    bla: '234',
                    toto: 123
                },
                relationships: {
                    arf: {id: '23', type: 'Item'},
                    bar: [
                        {id: '34', type: 'Item'},
                        {id: '42', type: 'Item'}
                    ]
                }
            };
            let builder = new JsonApiBuilder();
            let doc = builder.parse(jsonApiData);
            expect(doc._id).to.equal('foo');
            expect(doc._type).to.equal('Test');
            expect(doc.bla).to.equal('234');
            expect(doc.toto).to.equal(123);
            expect(doc.arf.id).to.equal('23');
            expect(doc.bar[0].id).to.equal('34');
            done();
        });
    });

    describe('#build()', function() {

        it('should build jsonapi from an archimedes instance', (done) => {
            let builder = new JsonApiBuilder();
            db.Generic.fetch('generic1').then((instance) => {
                return builder.build(db, 'http://example.com', instance);
            }).then(({data}) => {
                expect(data).to.be.an.object();
                expect(data.id).to.equal('generic1');
                expect(data.type).to.equal('Generic');
                expect(data.links.self).to.equal(
                    'http://example.com/generic/generic1');
                expect(data.attributes).to.be.an.object();
                expect(data.relationships).to.be.an.object();
                expect(data.relationships.relation.data.id).to.equal('relation1');
                expect(data.relationships.relation.data.type).to.equal('GenericRelation');
                expect(data.relationships.relation.links.self).to.equal(
                    'http://example.com/generic/generic1/relationships/relation');
                expect(data.relationships.relation.links.related).to.equal(
                    'http://example.com/generic/generic1/relation');
                done();
            }).catch((error) => {
                console.log(error);
                console.log(error.stack);
            });
        });

        it('should build jsonapi from an archimedes collection', (done) => {
            let builder = new JsonApiBuilder();
            db.Generic.find().then((instances) => {
                return builder.build(db, 'http://example.com', instances);
            }).then(({data}) => {
                expect(data).to.be.an.array();
                let doc = data[0];
                expect(doc.id).to.equal('generic1');
                expect(doc.type).to.equal('Generic');
                expect(doc.links.self).to.equal(
                    'http://example.com/generic/generic1');
                expect(doc.attributes).to.be.an.object();
                expect(doc.relationships).to.be.an.object();
                expect(doc.relationships.relation.data.id).to.equal('relation1');
                expect(doc.relationships.relation.data.type).to.equal('GenericRelation');
                expect(doc.relationships.relation.links.self).to.equal(
                    'http://example.com/generic/generic1/relationships/relation');
                expect(doc.relationships.relation.links.related).to.equal(
                    'http://example.com/generic/generic1/relation');
                done();
            }).catch((error) => {
                console.log(error);
                console.log(error.stack);
            });
        });


        it('should include relationships from an archimedes collection', (done) => {
            let builder = new JsonApiBuilder();
            db.Generic.find({}, {limit: 10}).then((instances) => {
                return builder.build(db, 'http://example.com', instances, {include: true});
            }).then(({data, included}) => {
                expect(data.length).to.equal(10);
                expect(included.length).to.equal(2);
                expect(included[0].attributes).to.be.an.object();
                done();
            }).catch((error) => {
                console.log(error);
                console.log(error.stack);
            });
        });

        it('should include relationships of an instance', (done) => {
            let builder = new JsonApiBuilder();
            db.Generic.fetch('generic1').then((instance) => {
                return builder.build(db, 'http://example.com', instance, {include: true});
            }).then(({data, included}) => {
                expect(data).to.be.an.object();
                expect(data.id).to.equal('generic1');
                expect(data.type).to.equal('Generic');
                expect(data.links.self).to.equal(
                    'http://example.com/generic/generic1');
                expect(data.attributes).to.be.an.object();
                expect(data.relationships).to.be.an.object();
                expect(data.relationships.relation.data.id).to.equal('relation1');
                expect(data.relationships.relation.data.type).to.equal('GenericRelation');
                expect(data.relationships.relation.links.self).to.equal(
                    'http://example.com/generic/generic1/relationships/relation');
                expect(data.relationships.relation.links.related).to.equal(
                    'http://example.com/generic/generic1/relation');

                expect(included).to.be.an.array();
                expect(included[0].attributes).to.be.an.object();
                done();
            }).catch((error) => {
                console.log(error);
                console.log(error.stack);
            });
        });

        it('should throw an error if no database is passed', (done) => {
            let builder = new JsonApiBuilder();
            builder.build().catch((error) => {
                expect(error.message).to.equal(
                    'JsonApiBuilder: database is required');
                done();
            });
        });

        it('should throw an error if the database is not an archimedes database', (done) => {
            let builder = new JsonApiBuilder();
            builder.build('foo').catch((error) => {
                expect(error.message).to.equal(
                    'JsonApiBuilder: database should be an archimedes database');
                done();
            });
        });

        it('should throw an error if no apiBaseUri is passed', (done) => {
            let builder = new JsonApiBuilder();
            builder.build(db).catch((error) => {
                expect(error.message).to.equal(
                    'JsonApiBuilder: apiBaseUri is required');
                done();
            });
        });

        it('should throw an error if the apiBaseUri is not an URL', (done) => {
            let builder = new JsonApiBuilder();
            db.Generic.first().then((instance) => {
                return builder.build(db, 'foo', instance);
            }).catch((error) => {
                expect(error.message).to.equal(
                    'JsonApiBuilder: apiBaseUri should be a valid uri');
                done();
            });
        });

        it('should throw an error if no instance is passed', (done) => {
            let builder = new JsonApiBuilder();
            builder.build(db, 'http://example.com').catch((error) => {
                expect(error.message).to.equal(
                    'JsonApiBuilder: an archimedes model instance is required');
                done();
            });
        });


    });

});
