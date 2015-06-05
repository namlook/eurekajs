/* eslint-env node, mocha */
/* eslint no-unused-expressions:0 */

import chai from 'chai';
chai.config.includeStack = true;
var expect = chai.expect;

import server from '../server';

describe('ModelSchema', function(){

    it('should return a property', function() {
        var property = server.database.Generic.schema.getProperty('text');
        expect(property.type).to.be.equal('string');
    });

    it('should return a deep property', function() {
        var property = server.database.Generic.schema.getProperty('relation.related');
        expect(property.type).to.be.equal('boolean');
    });
});