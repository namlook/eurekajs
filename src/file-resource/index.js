
import routes from './routes';
import {thumbnailize} from './methods';

export default {
    methods: {thumbnailize},
    routes: function(options) {
        return routes(options).all;
    }
};
