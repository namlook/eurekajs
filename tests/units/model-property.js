/* eslint-env node, mocha */
/* eslint no-unused-expressions:0 */

import chai from 'chai';
chai.config.includeStack = true;
var expect = chai.expect;

import server from '../server';

describe('ModelProperty', function(){

    it('should return the type of the property', function() {
        var textProperty = server.database.Generic.schema.getProperty('text');
        expect(textProperty.type).to.be.equal('string');
        var relationProperty = server.database.Generic.schema.getProperty('relation');
        expect(relationProperty.type).to.be.equal('GenericRelation');
    });

    it('should return true if its a relation', function() {
        var relationProperty = server.database.Generic.schema.getProperty('relation');
        expect(relationProperty.isRelation).to.be.true;
        var textProperty = server.database.Generic.schema.getProperty('text');
        expect(textProperty.isRelation).to.be.false;
    });

});