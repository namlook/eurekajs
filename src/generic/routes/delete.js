
import fetchDocumentMdw from '../../middlewares/fetch-document';
import path from 'path';
import fs from 'fs';


/** remove referenced files from file system if propagateDeletion is true **/
var removeReferencedFileMdw = function(req, res, next) {
    var filePathProperties = [];
    var properties = req.Model.schema.properties;
    properties.forEach(function(property) {
        /** if the property is a string, and propagateDeletion is true,
         *  it means that the property is represente the path of the file
         *  that we have to delete as well
         */
        if (properties.propagateDeletion && properties.type === 'string') {
            filePathProperties.push(property.name);
        }
    });

    /** if the model references any attached files, delete those files **/
    if (filePathProperties.length) {
        var fileFullPath;
        filePathProperties.forEach(function(propertyName) {
            fileFullPath = path.resolve('.', req.config.uploadDirectory, req.document.get(propertyName));
            req.logger.debug(`removing ${fileFullPath}`);
            fs.unlink(fileFullPath, function(err) {
                if (err) {
                    req.logger.error(`cannot remove file ${fileFullPath}`);
                }
                return next();
            });
        });
    } else {
        return next();
    }
};

export default {
    _generic: true,
    path: '/:id',
    method: 'delete',
    beforeHandler: [fetchDocumentMdw, removeReferencedFileMdw],
    policies: [
        {group: {id: 'admin'}},
        {user: {field: '_owner'}}
    ],
    handler: function(req, res) {
        req.attrs.document.delete(function(err) {
            if (err) {
                return res.serverError(err);
            }
            return res.status(204).json({status: 204});
        });
    }
};