
import _ from 'lodash';

export var pascalCase = function(string) {
    return _.capitalize(_.camelCase(string));
};