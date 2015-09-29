
import fileResource from '../../../lib/file-resource';


export default function(options) {
    let resource = fileResource(options);
    /** everyone can upload an download a file **/
    resource.auth = false;

    return resource;
}