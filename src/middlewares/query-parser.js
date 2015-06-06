
import QueryParser from '../utils/query-parser';

export default function(req, res, next) {
    req.parsedQuery = new QueryParser(req.db, req.resource.name, req.query);

    var errors = req.parsedQuery.errors;
    if (errors) {
        return res.badRequest('bad request', {'issue': 'bad query', reasons: errors});
    }

    return next();
}
