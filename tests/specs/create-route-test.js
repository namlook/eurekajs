
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

const jsonApiMime = 'application/vnd.api+json';


describe('Route [create]', function() {

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

    it('should create a document', function(done){

        var date = new Date(1984, 7, 3);

        let options = {
            method: 'POST',
            url: '/api/1/generics',
            payload: {
                data: {
                    type: 'Generic',
                    attributes: {
                        text: 'hello world',
                        boolean: true,
                        integer: 42,
                        float: 3.14,
                        date: new Date(1984, 7, 3)
                    },
                    relationships: {
                        relation: {
                            data: {id: 'relation0', type: 'GenericRelation'}
                        },
                        relations: {
                            data: [
                                {id: 'relation0', type: 'GenericRelation'},
                                {id: 'relation1', type: 'GenericRelation'}
                            ]
                        }
                    }
                }
            }
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(201);
            expect(response.headers['content-type']).to.include(jsonApiMime);
            let doc = response.result.data;
            expect(doc.id).to.not.be.null();
            expect(doc.type).to.equal('Generic');
            expect(doc.attributes.text).to.equal('hello world');
            expect(doc.attributes.boolean).to.be.true();
            expect(doc.attributes.integer).to.equal(42);
            expect(doc.attributes.float).to.equal(3.14);

            let fetchedDate = new Date(doc.attributes.date);
            expect(fetchedDate.getTime()).to.be.equal(date.getTime());

            expect(doc.relationships.relation.data.id).to.equal('relation0');
            expect(doc.relationships.relation.data.type).to.equal('GenericRelation');

            let relations = doc.relationships.relations.data;
            expect(relations[0].id).to.equal('relation0');
            expect(relations[0].type).to.equal('GenericRelation');
            expect(relations[1].id).to.equal('relation1');
            expect(relations[1].type).to.equal('GenericRelation');

            expect(response.result.links).to.be.an.object();
            expect(response.result.links.self).to.contains(`/generics/${doc.id}`);
            done();
        });
    });


    it('should throw a 400 error when passing an empty payload', function(done){

        let options = {
            method: 'POST',
            url: '/api/1/generics'
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(400);
            expect(response.headers['content-type']).to.include(jsonApiMime);

            let error = response.result.errors[0];
            expect(error.status).to.equal(400);
            expect(error.title).to.equal('Bad Request');
            expect(error.detail).to.equal('ValidationError');

            let options2 = {
                method: 'POST',
                url: `/api/1/generics`,
                payload: ''
            };

            server.inject(options2, function(response2) {
                expect(response2.statusCode).to.equal(400);
                expect(response2.headers['content-type']).to.include(jsonApiMime);

                let error2 = response2.result.errors[0];
                expect(error2.status).to.equal(400);
                expect(error2.title).to.equal('Bad Request');
                expect(error2.detail).to.equal('ValidationError');

                done();
            });
        });
    });


    it('should throw an error if the id is already taken', function(done){

        let options = {
            method: 'POST',
            url: '/api/1/generics',
            payload: {
                data: {
                    id: 'foo',
                    type: 'Generic',
                    attributes: {
                        text: 'hello world',
                        boolean: true,
                        integer: 42,
                        float: 3.14,
                        date: new Date(1984, 7, 3)
                    }
                }
            }
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(201);
            expect(response.headers['content-type']).to.include(jsonApiMime);

            let doc = response.result.data;
            expect(doc.id).to.not.be.null();

            let options2 = {
                method: 'POST',
                url: '/api/1/generics',
                payload: {
                    data: {
                        id: 'foo',
                        type: 'Generic',
                        attributes: {
                            text: 'hello world'
                        }
                    }
                }
            };

            server.inject(options2, function(response2) {
                expect(response2.statusCode).to.equal(409);
                expect(response2.headers['content-type']).to.include(jsonApiMime);

                let error = response2.result.errors[0];
                expect(error.status).to.equal(409);
                expect(error.title).to.equal('Conflict');

                done();
            });
        });
    });


    it('should throw an error if the payload has unknown properties', function(done){

        let options = {
            method: 'POST',
            url: '/api/1/generics',
            payload: {
                data: {
                    type: 'Generic',
                    attributes: {
                        unknownField: 'hello world',
                        boolean: true,
                        integer: 42,
                        float: 3.14,
                        date: new Date(1984, 7, 3)
                    }
                }

            }
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(400);
            expect(response.headers['content-type']).to.include(jsonApiMime);

            let error = response.result.errors[0];
            expect(error.status).to.equal(400);
            expect(error.title).to.equal('Bad Request');
            expect(error.detail).to.equal('ValidationError: "unknownField" is not allowed');

            done();
        });
    });

    it('should throw an error if a property has bad type value', function(done){

        let options = {
            method: 'POST',
            url: '/api/1/generics',
            payload: {
                data: {
                    type: 'Generic',
                    attributes: {
                        text: 'hello world',
                        boolean: 'arf',
                        integer: 42,
                        float: 3.14,
                        date: new Date(1984, 7, 3)
                    }
                }
            }
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(400);
            expect(response.headers['content-type']).to.include(jsonApiMime);

            let error = response.result.errors[0];
            expect(error.status).to.equal(400);
            expect(error.title).to.equal('Bad Request');
            expect(error.detail).to.equal('ValidationError: "boolean" must be a boolean');

            done();
        });
    });

    it('should throw a 400 error when passing bad relationship', function(done){

        let options = {
            method: 'POST',
            url: '/api/1/generics',
            payload: {
                data: {
                    type: 'Generic',
                    attributes: {
                        text: 'hello world'
                    },
                    relationships: {
                        relation: {
                            data: {bla: 'relation0', foo: 'GenericRelation'}
                        }
                    }
                }
            }
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(400);
            expect(response.headers['content-type']).to.include(jsonApiMime);

            let error = response.result.errors[0];
            expect(error.status).to.equal(400);
            expect(error.title).to.equal('Bad Request');
            expect(error.detail).to.equal('ValidationError');
            done();
        });
    });


    it('should throw a 400 error when passing bad relationships', function(done){

        let options = {
            method: 'POST',
            url: '/api/1/generics',
            payload: {
                data: {
                    type: 'Generic',
                    attributes: {
                        text: 'hello world'
                    },
                    relationships: {
                        relations: {
                            data: [
                                {bla: 'relation0', foo: 'GenericRelation'}
                            ]
                        }
                    }
                }
            }
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(400);
            expect(response.headers['content-type']).to.include(jsonApiMime);

            let error = response.result.errors[0];
            expect(error.status).to.equal(400);
            expect(error.title).to.equal('Bad Request');
            expect(error.detail).to.equal('ValidationError');
            done();
        });
    });



    it.skip('accept a list of document (batch)', function(done){

        var generics = [];
        for (var i = 1; i < 11; i++) {
            generics.push({
                type: 'Generic',
                attributes: {
                    text: `hello world ${i}`,
                    boolean: Boolean(i % 2),
                    integer: i,
                    float: i + 0.14,
                    date: new Date(1984, 7, i)
                }
            });
        }

        let options = {
            method: 'POST',
            url: '/api/1/generics',
            payload: {
                data: generics
            }
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(201);
            expect(response.result.statusCode).to.equal(201);

            let data = response.result.results;
            expect(data).to.be.an.array();
            expect(data.length).to.be.equal(10);
            data.forEach(function(item){
                expect(item.text).to.match(/^hello world/);
            });

            done();
        });
    });

});