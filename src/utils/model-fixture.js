
// config.fixture should be a function that will return the value
// see fakerjs, chancejs or casual (https://github.com/boo1ean/casual)

import _ from 'lodash';

export default class ModelFixture {

    constructor(schema) {
        this._schema = schema;
        this._properties = this._schema.properties;
    }

    generate(nbObjects=1) {
        var fixtures = [];
        _.range(nbObjects, function(index) {
            var pojo = {};
            this._properties.forEach(function(property) {
                pojo[property.name] = property.fixture();
            });
            pojo._id = `${this._schema.name}${index}`;
            fixtures.push(pojo);
        });
        if (nbObjects === 1) {
            return fixtures[0];
        }
        return fixtures;
    }
}