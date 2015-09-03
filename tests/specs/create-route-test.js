
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
            url: `/api/1/generic`,
            payload: {
                text: 'hello world',
                boolean: true,
                integer: 42,
                float: 3.14,
                date: new Date(1984, 7, 3)

            }
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(201);
            expect(response.result.statusCode).to.equal(201);

            let doc = response.result.results;
            expect(doc._id).to.not.be.null();
            expect(doc.text).to.equal('hello world');
            expect(doc.boolean).to.be.true();
            expect(doc.integer).to.equal(42);
            expect(doc.float).to.equal(3.14);
            let fetchedDate = new Date(doc.date);
            expect(fetchedDate.getTime()).to.be.equal(date.getTime());

            done();
        });
    });

    it('should throw an error if the payload has unknown properties', function(done){

        let options = {
            method: 'POST',
            url: `/api/1/generic`,
            payload: {
                unknownField: 'hello world',
                boolean: true,
                integer: 42,
                float: 3.14,
                date: new Date(1984, 7, 3)

            }
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(400);
            expect(response.result.statusCode).to.equal(400);
            expect(response.result.error).to.equal('Bad Request');
            expect(response.result.message).to.equal('ValidationError: "unknownField" is not allowed');

            done();
        });
    });

    it('should throw an error if a property has bad type value', function(done){

        let options = {
            method: 'POST',
            url: `/api/1/generic`,
            payload: {
                text: 'hello world',
                boolean: 'arf',
                integer: 42,
                float: 3.14,
                date: new Date(1984, 7, 3)

            }
        };

        server.inject(options, function(response) {
            expect(response.statusCode).to.equal(400);
            expect(response.result.statusCode).to.equal(400);
            expect(response.result.error).to.equal('Bad Request');
            expect(response.result.message).to.equal('ValidationError: "boolean" must be a boolean');

            done();
        });
    });

    it('accept a list of document (batch)', function(done){

        var generics = [];
        for (var i = 1; i < 11; i++) {
            generics.push({
                text: `hello world ${i}`,
                boolean: Boolean(i % 2),
                integer: i,
                float: i + 0.14,
                date: new Date(1984, 7, i)
            });
        }

        let options = {
            method: 'POST',
            url: `/api/1/generic`,
            payload: generics
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