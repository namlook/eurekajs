
export default function(resource) {
    return function loadResourceInfosMiddleware(req, res, next) {
        req.resource = resource;
        return next();
    };
}