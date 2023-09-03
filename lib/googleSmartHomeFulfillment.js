function GoogleSmartHomeFulfillment(server, webSettings, adapter, config, app) {
    adapter.log.info('Starting : GoogleSmartHomeFulfillment');

    // Add function to get lists - yerch
    adapter.getForeignStateListAsync = async (id) => {
        const state = await adapter.getForeignStateAsync(id);
        if (state && typeof state.val === 'string') {
            state.val = JSON.parse(state.val);
        }
        return state;
    };

    // Construct more config from that given
    const instanceSettings = config.native;
    let configPass = false;
    try {
        const keyObject = JSON.parse(instanceSettings.homeGraphJSONKey);
        instanceSettings.homeGraphJSONKey = keyObject;
        instanceSettings.publicUrl = `https://${instanceSettings.publicFQDN}/oidc`;
        instanceSettings.oauthRedirect = `https://oauth-redirect.googleusercontent.com/r/${instanceSettings.homeGraphJSONKey.project_id}`;
        instanceSettings.oauthWritePeriod = 300000; // Flush memory cache to disk every 5 minutes
        instanceSettings.agentUserId = 'dummy'; // ... as we don't care about this
        configPass = true;
    } catch (error) {
        // This is only really here to catch JSON parsing errors. Erm... IIRC ;)
        adapter.log.error(error);
    }
    if (!configPass) {
        adapter.log.error('Failed to construct added configuration from that given. Please check adapter configuration.');
        return;
    }

    // Because there are plugins called later on, create a method to both subscribe
    // to states and make a note of the handler changes to this state should be
    // passed to

    adapter.subscribedStatesHandlers = [];
    adapter.subscribeForeignStateHandler = async(id, handler) => {
        adapter.log.debug(`Subscribing to ${id}`);
        adapter.subscribedStatesHandlers[id] = handler;
        adapter.subscribeForeignStatesAsync(id);
    };

    // We need to use bodyparser for Google Actions to work
    const bodyParser = require('body-parser');
    app.use(bodyParser.json());

    // OAuth
    const { Provider } = require('oidc-provider');
    const IobStateCacheAdapter = require('./iobStateCacheAdapter.js')(adapter, instanceSettings);

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
        adapter: IobStateCacheAdapter,
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
    app.enable('trust proxy');
    oidc.proxy = true;

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
                    adapter.log.error('Cannot find bearer token - rejecting request: ' + JSON.stringify(req.headers));
                    res.sendStatus(400);
                }
            });
        } else {
            adapter.log.error('No authorization header - rejecting request: ' + JSON.stringify(req.headers));
            res.sendStatus(400);
        }
    }

    const GoogleSmartHomeApp = require('./googleSmartHomeApp.js');
    const googleSmartHomeApp = new GoogleSmartHomeApp(adapter, instanceSettings);
    app.post('/fulfillment', verifyToken, googleSmartHomeApp.getApp());
    googleSmartHomeApp.init();
}

module.exports = GoogleSmartHomeFulfillment;