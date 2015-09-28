
import fileResource from '../../../lib/file-resource';

/** everyone can upload an download a file **/
fileResource.auth = false;

export default fileResource;