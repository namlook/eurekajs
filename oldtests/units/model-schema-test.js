/* eslint-env node, mocha */
/* eslint no-unused-expressions:0 */

import chai from 'chai';
chai.use(require('chai-http'));
chai.config.includeStack = true;
var expect = chai.expect;

import server from '../server';

describe('ModelSchema', function(){

    describe('=== properties ===', function() {

        describe('#getProperty', function() {
            it('should return a property', function() {
                var property = server.database.Generic.schema.getProperty('text');
                expect(property.type).to.be.equal('string');
            });

            it('should return a deep property', function() {
                var property = server.database.Generic.schema.getProperty('relation.related');
                expect(property.type).to.be.equal('boolean');
            });
        });

        describe('#properties', function() {

            it('should return the list of all properties', function() {
                var properties = server.database.Generic.schema.properties;
                var schemaProperties = Object.keys(server.database.Generic.schema._schema.properties);
                properties.forEach(function(property) {
                    expect(schemaProperties).to.contains(property.name);
                });
            });

        });
    });

    describe('=== validation ===', function() {
        it('should validate some values (no errors)', function(done) {
            var schema = server.database.Generic.schema;
            var validation = schema.validate({integer: '3', boolean: 'true'});
            expect(validation.error).to.be.null;
            expect(validation.value).to.deep.equal({integer: 3, boolean: true});

            schema.validate({integer: 3, boolean: 'yes'}, function(err, value) {
                expect(err).to.be.null;
                expect(value).to.deep.equal({integer: 3, boolean: true});
                done();
            });
        });

        it('should validate some values (with errors)', function(done) {
            var schema = server.database.Generic.schema;
            var validation = schema.validate({integer: '3a', boolean: 'bla'});
            expect(validation.error).to.not.be.null;
            expect(validation.value).to.deep.equal({integer: NaN, boolean: 'bla'});

            schema.validate({integer: '3a', boolean: 'bla'}, function(err, value) {
                expect(err).to.not.be.null;
                expect(value).to.deep.equal({integer: NaN, boolean: 'bla'});
                done();
            });
        });

        it('should validate arrays', function() {
            var schema = server.database.Generic.schema;
            var validationOk = schema.validate({integer: '3', boolean: 'true', array: ['foo', 'bar', 'bla']});
            expect(validationOk.error).to.be.null;
            expect(validationOk.value).to.deep.equal({integer: 3, boolean: true, array: ['foo', 'bar', 'bla']});

            var validationFailed = schema.validate({integer: '3', boolean: 'true', array: ['1', 'bla', 3]});
            expect(validationFailed.error).to.not.be.null;
            expect(validationFailed.error.details[0].message).to.equal('"array" must be a string');
            expect(validationFailed.error.details[0].path).to.equal('array.2');
            expect(validationFailed.value).to.deep.equal({integer: 3, boolean: true, array: ['1', 'bla', 3]});

            var validationFailed2 = schema.validate({integer: '3', boolean: 'true', array: ['foo', 'bar', 'bla', 'arf']});
            expect(validationFailed2.error).to.not.be.null;
            expect(validationFailed2.error.details[0].message).to.equal('"array" must contain 3 items');
            expect(validationFailed2.value).to.deep.equal({integer: 3, boolean: true, array: ['foo', 'bar', 'bla', 'arf']});

        });
    });

    describe('=== fixtures ===', function() {
        it('should generate a fixture from schema');//, function() {
        //     var fixture = server.database.Generic.schema.fixtures.generate(10);
        //});
    });

});