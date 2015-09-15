import _ from 'lodash';

export var pascalCase = function(string) {
    return _.capitalize(_.camelCase(string));
};

export var resourceObjectLink = function(apiBaseUri, instance) {
    return `${apiBaseUri}/${_.kebabCase(instance._type)}/${instance._id}`;
};