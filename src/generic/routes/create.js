
import _ from 'lodash';
import {pascalCase} from '../../utils';

export default {
    _generic: true,
    path: '/',
    method: 'post',
    policies: [],
    action: function(req, res) {
        try {
            var payload = JSON.parse(req.body.payload);
        } catch (error) {
            // req.logger.error({error: 'cannot parse payload. Reason: '+e, payload: payload});
            return res.badRequest(`cannot parse payload. Reason: ${error}`);
        }

        /** if the payload is an array, use batchSync **/
        if (_.isArray(payload)) {
            var pojos = [];
            payload.forEach(function(pojo) {
                delete pojo._type;
                try {
                    pojos.push(new req.resource.Model(pojo).toSerializableObject());
                } catch (error) {
                // req.logger.error({error: e, payload: payload});
                    return res.badRequest(error);
                }
            });

            return req.db.batchSync(pojos, function(err, data) {
                if (err) {
                    return res.serverError(err);
                }
                data.forEach(function(result) {
                    result.result._type = pascalCase(req.resource.name); // TODO use regular name
                    result.result = new req.resource.Model(result.result).toJSONObject({
                        dereference: true
                    });
                });

                return res.sendResults(data.map(function(savedObj) {
                    return savedObj.result;
                }));
              });

        } else {
            /** else, use regular save method **/

            delete payload._type;
            var obj;
            try {
                obj = new req.resource.Model(payload);
            } catch (error) {
                // req.logger.error({error: e, payload: payload});
                return res.serverError(error);
            }

            return obj.save(function(err, savedObj) {
                if (err) {
                    // req.logger.error({error: err});
                    return res.serverError(err);
                }

                return res.sendResults(savedObj.toJSONObject({dereference: true}));
            });
        }
    }
};