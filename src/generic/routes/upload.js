
export default {
    _generic: true,
    path: /^\/api\/1\/_files\/([^\/]+?(?:\/[^\/]+?)*)(?:\/(?=$))?$/i,
    method: 'post',
    policies: [],
    action: function(req, res) {
        return res.sendResults(`upload file`);
    }
};