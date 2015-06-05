
var buildCustomErrorResponse = function(status) {
    return function(error, infos) {
        var response = {status: status};

        if (this.req.server.config.env === 'production') {
            error = 'An error happened. We have been notified';
        } else {
            if (typeof error === 'object') {
                error = error.message;
            }
        }

        response[error] = error;

        if (infos) {
            response.infos = infos;
        }

        this.req.logger.error(response);
        return this.status(status).json(response);
    };
};

var httpResponses = {
    notFound: buildCustomErrorResponse(404),
    forbidden: buildCustomErrorResponse(403),
    badRequest: buildCustomErrorResponse(400),
    serverError: buildCustomErrorResponse(500),
    sendResults: function(results) {
        let status = 200;
        return this.status(status).json({results: results, status: status});
    }
};

var addResponseHelpers = function(res) {
    Object.keys(httpResponses).forEach(function(responseName) {
        res[responseName] = httpResponses[responseName];
    });
};

export default function(req, res, next) {
    addResponseHelpers(res);
    return next();
}
