
import _ from 'lodash';
import fs from 'fs';
import path from 'path';

import joi from 'joi';

export default function(options) {
    const MAX_FILE_SIZE = options.fileUploads.maxBytes;
    const UPLOAD_DIR = options.fileUploads.uploadDirectory;

    let routes = {

        /*** hack for dropzone while waiting that the folling issue is fixed
         *
         * https://github.com/enyo/dropzone/pull/685
         *
         */
        options: {
            method: 'OPTIONS',
            path: '/',
            config: {
                cors: {
                    headers: ['Authorization', 'Content-Type', 'If-None-Match', 'Cache-Control', 'X-Requested-With']
                }
            },
            handler: function(request, reply) {
                return reply.noContent();
            }
        },

        upload: {
            method: 'POST',
            path: '/',
            config: {
                payload: {
                    output: 'file',
                    parse: true,
                    maxBytes: MAX_FILE_SIZE * Math.pow( 1024, 2 ),
                    uploads: UPLOAD_DIR
                }
            },
            handler: function(request, reply) {
                let file = request.payload.file;
                let {name, ext} = path.parse(file.filename);
                let slug = _.words(_.deburr(name.toLowerCase())).join('-');
                let {dir, name: id} = path.parse(file.path);

                let fullpath = `${dir}/${id}_${slug}${ext}`;

                fs.rename(file.path, fullpath, (err) => {
                    if (err) {
                        return reply.badImplementation(err);
                    }

                    let filename = path.parse(fullpath).base;
                    return reply.ok({filename: filename});
                });
            }
        },

        download: {
            method: 'GET',
            path: '/{filename*}',
            handler: function(request, reply) {
                let filename = request.params.filename;
                let filepath = path.join(UPLOAD_DIR, filename);

                return reply.file(filepath);
                // fs.access(filepath, fs.R_OK, function(accessError) {
                //     if (accessError) {
                //         return reply.notFound();
                //     }

                //     return reply(fs.createReadStream(filepath));
                //         // .header('Content-Disposition', `attachment; filename="${filename}"`);

                // });
            }
        },

        thumbnail: {
            method: 'GET',
            path: '/i/thumb/{width}x{height}/{filename*}',
            validate: {
                params: {
                    width: joi.number().integer().default(200),
                    height: joi.number().integer().default(200)
                }
            },
            handler: function(request, reply) {
                let filename = request.params.filename;
                let filepath = path.join(UPLOAD_DIR, filename);

                let {width, height} = request.params;
                let mimeType = request.server.mime.path(filepath).type;

                if (!_.startsWith(mimeType, 'image')) {
                    return reply.notAcceptable(
                        `Thumbnail can be generated only from an image. Not "${mimeType}"`);
                }


                fs.stat(filepath, function(statError, info) {
                    if (statError) {
                        return reply.notFound();
                    }

                    if (info.size === 0) {
                        return reply.badData('empty file');
                    }

                    request.server.methods.thumbnailize(filepath, width, height, function(err, binaryString) {
                        if (err) {
                            return reply.badImplementation(err);
                        }

                        let buffer = new Buffer(binaryString, 'binary');
                        return reply(buffer).type(mimeType);
                    });
                });
            }
        },

        delete: {
            method: 'DELETE',
            path: '/{filename*}',
            handler: function(request, reply) {
                let filename = request.params.filename;
                let filepath = path.join(UPLOAD_DIR, filename);

                fs.unlink(filepath, (err) => {
                    if (err) {
                        if (err.code === 'ENOENT') {
                            return reply.notFound();
                        }
                        return reply.badImplementation(err);
                    }
                    return reply.noContent();
                });
            }
        }
    };

    return routes;
}
