
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

var buildCustomSuccessResponse = function(status) {
    return function(data) {
        var response = {status: status, results: data};
        return this.status(status).json(response);
    };
};

var httpResponses = {
    badRequest: buildCustomErrorResponse(400, 'bad request'),
    unauthorized: buildCustomErrorResponse(401, 'unauthorized'),
    forbidden: buildCustomErrorResponse(403, 'forbidden'),
    notFound: buildCustomErrorResponse(404, 'not found'),
    conflict: buildCustomErrorResponse(409, 'conflict'),
    requestTooLarge: buildCustomErrorResponse(413, 'request entity too large'),
    serverError: buildCustomErrorResponse(500),

    ok: buildCustomSuccessResponse(200),
    sendResults: buildCustomSuccessResponse(200),
    created: buildCustomSuccessResponse(201)
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
