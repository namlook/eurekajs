
export default class ModelFixture {

    constructor(schema) {
        this._schema = schema;
        this._properties = this._schema.properties;
    }

    generate(nbObjects=1) {
        var fixtures = [];
        for (let i=0 ; i<nbObjects; i++) {
            var pojo = {};
            this._properties.forEach(function(property) {
                pojo[property.name] = property.fixture();
            });
            pojo._id = `${this._schema.name}${i}`;
            fixtures.push(pojo);
        }
        if (nbObjects === 1) {
            return fixtures[0];
        }
        return fixtures;
    }
}