
import QueryParser from '../utils/query-parser';

export default function(req, res, next) {
    req.parsedQuery = new QueryParser(req.db, req.resource.name, req.query);
    return next();
}
