
import routes from './routes';
import {thumbnailize} from './methods';

export default function(options) {
    return {
        methods: {thumbnailize},
        routes: routes(options)
    };
}
