
import gm from 'gm';
import path from 'path';

let methods = {
    thumbnailize: {
        options: {
            cache: {
                expiresIn: 60 * 60 * 1000,
                staleIn: 10 * 1000,
                staleTimeout: 100,
                generateTimeout: 10000
            }
        },
        method: function(filepath, width, height, next) {
            let ext = path.extname(filepath).slice(1).toUpperCase();

            let resizeValue = width >= height && width || height;

            gm(filepath)
                .gravity('Center')
                .resize(resizeValue, resizeValue)
                // .resize(width, height + '^>')
                .quality(90)
                .crop(width, height)
                .toBuffer(ext, function(err, buffer) {
                    if (err) {
                        return next(err);
                    }
                    return next(null, buffer.toString('binary'));
                });
        }
    }
};

export default methods;