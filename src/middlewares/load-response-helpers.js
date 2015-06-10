
var buildCustomErrorResponse = function(status, productionErrorMessage) {
    return function(error, infos) {
        var response = {status: status};

        if (this.req.server.config.env === 'production') {
            error = productionErrorMessage || 'An error happened. We have been notified';
        } else {
            if (typeof error === 'object') {
                error = error.message;
            }
        }

        response.error = error;

        if (infos) {
            response.infos = infos;
        }

        this.req.logger.error(response);
        return this.status(status).json(response);
    };
};

var httpResponses = {
    notFound: buildCustomErrorResponse(404, 'not found'),
    forbidden: buildCustomErrorResponse(403, 'forbidden'),
    badRequest: buildCustomErrorResponse(400, 'bad request'),
    serverError: buildCustomErrorResponse(500),
    requestTooLarge: buildCustomErrorResponse(413, 'request entity too large'),
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
