'use strict';

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _joi = require('joi');

var _joi2 = _interopRequireDefault(_joi);

exports['default'] = function (options) {
    var MAX_FILE_SIZE = options.fileUploads.maxBytes;
    var UPLOAD_DIR = options.fileUploads.uploadDirectory;

    var routes = {

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
            handler: function handler(request, reply) {
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
                    maxBytes: MAX_FILE_SIZE * Math.pow(1024, 2),
                    uploads: UPLOAD_DIR
                }
            },
            handler: function handler(request, reply) {
                var file = request.payload.file;

                var _path$parse = _path2['default'].parse(file.filename);

                var name = _path$parse.name;
                var ext = _path$parse.ext;

                var slug = _lodash2['default'].words(_lodash2['default'].deburr(name.toLowerCase())).join('-');

                var _path$parse2 = _path2['default'].parse(file.path);

                var dir = _path$parse2.dir;
                var id = _path$parse2.name;

                var fullpath = dir + '/' + id + '_' + slug + ext;

                _fs2['default'].rename(file.path, fullpath, function (err) {
                    if (err) {
                        return reply.badImplementation(err);
                    }

                    var filename = _path2['default'].parse(fullpath).base;
                    return reply.ok({ filename: filename });
                });
            }
        },

        download: {
            method: 'GET',
            path: '/{filename*}',
            handler: function handler(request, reply) {
                var filename = request.params.filename;
                var filepath = _path2['default'].join(UPLOAD_DIR, filename);

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
                    width: _joi2['default'].number().integer()['default'](200),
                    height: _joi2['default'].number().integer()['default'](200)
                }
            },
            handler: function handler(request, reply) {
                var filename = request.params.filename;
                var filepath = _path2['default'].join(UPLOAD_DIR, filename);

                var _request$params = request.params;
                var width = _request$params.width;
                var height = _request$params.height;

                var mimeType = request.server.mime.path(filepath).type;

                if (!_lodash2['default'].startsWith(mimeType, 'image')) {
                    return reply.notAcceptable('Thumbnail can be generated only from an image. Not "' + mimeType + '"');
                }

                _fs2['default'].stat(filepath, function (statError, info) {
                    if (statError) {
                        return reply.notFound();
                    }

                    if (info.size === 0) {
                        return reply.badData('empty file');
                    }

                    request.server.methods.thumbnailize(filepath, width, height, function (err, binaryString) {
                        if (err) {
                            return reply.badImplementation(err);
                        }

                        var buffer = new Buffer(binaryString, 'binary');
                        return reply(buffer).type(mimeType);
                    });
                });
            }
        },

        'delete': {
            method: 'DELETE',
            path: '/{filename*}',
            handler: function handler(request, reply) {
                var filename = request.params.filename;
                var filepath = _path2['default'].join(UPLOAD_DIR, filename);

                _fs2['default'].unlink(filepath, function (err) {
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
};

module.exports = exports['default'];