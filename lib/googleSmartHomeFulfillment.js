function GoogleSmartHomeFulfillment(server, webSettings, adapter, instanceSettings, app) {
    adapter.log.info('Starting : GoogleSmartHomeFulfillment');
    adapter.log.debug('instanceSettings: ' + JSON.stringify(instanceSettings));

    // We need to use bodyparser for Google Actions to work
    const bodyParser = require('body-parser');
    app.use(bodyParser.json());

    // Subscribe to PdV lighting changes
    adapter.subscribeForeignStates('loxone.0.0f20f047-026b-2c81-fffff62eeb38b63d.activeMoods');
    adapter.on('stateChange', function (id, state) {
        adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));
    });

    // OAuth
    const Provider = require('oidc-provider');
    const iobStateCacheAdapter = require('./iobStateCacheAdapter.js');
    iobStateCacheAdapter.setCtx(adapter, instanceSettings);

    // Generate JWS key and add to config before finishing init
    // TODO: maybe we should stash this so it doesn't have to be generated every time?

    const { JWK: { generateSync } } = require('jose');
    const key = generateSync('RSA', 2048, { use: 'sig' });
    const jwk = key.toJWK(true);
    adapter.log.debug('Generated jwk:' + JSON.stringify(jwk));

    // Generate a random cookie key

    const randomString = require('randomstring');
    const cookies = randomString.generate();
    adapter.log.debug('Generated cookie key: ' + cookies);

    // Config

    const configuration = {
        adapter: iobStateCacheAdapter,
        clients: [{
            client_id: instanceSettings.oauthClientId,
            client_secret: instanceSettings.oauthClientSecret,
            redirect_uris: [instanceSettings.oauthRedirect],
            grant_types: ['refresh_token', 'authorization_code'],
        }],
        cookies: { keys: [cookies] },
        jwks: jwk,
        scopes: ['Fulfillment'], // sic. US spelling to match Google
        issueRefreshToken: function () { return true; },
        ttl: {
            AccessToken: 600,
            AuthorizationCode: 600,
            ClientCredentials: 600,
            DeviceCode: 600,
            IdToken: 3600,
            RefreshToken: 10 * 365 * 24 * 60 * 60 // 10 years
        }
    };
    const oidc = new Provider(instanceSettings.publicUrl, configuration);
    app.use('/oidc', oidc.callback);

    // Google Smart Home stuff
    function verifyToken(req, res, next) {
        const authorization = req.headers.authorization;
        if (authorization) {
            const bearer = authorization.split(' ')[1];
            adapter.log.debug('bearer: ' + bearer);
            oidc.AccessToken.find(bearer).then(function (token) {
                adapter.log.debug('token: ' + JSON.stringify(token));
                if (typeof token !== 'undefined') {
                    next();
                } else {
                    adapter.log.error('Cannot find bearer token - rejecting request');
                    res.sendStatus(401);
                }
            });
        } else {
            adapter.log.error('No authorization header - rejecting request');
            res.sendStatus(401);
        }
    }

    const GoogleSmartHomeApp = require('./googleSmartHomeApp.js');
    const googleSmartHomeApp = new GoogleSmartHomeApp(adapter, instanceSettings);
    app.post('/fulfillment', verifyToken, googleSmartHomeApp.getApp());
    googleSmartHomeApp.init();
}

module.exports = GoogleSmartHomeFulfillment;