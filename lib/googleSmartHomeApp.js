class GoogleSmartHomeApp {
    constructor(adapter, instanceSettings) {
        adapter.log.debug('GoogleSmartHomeApp: constructor');
        this.adapter = adapter;
        this.instanceSettings = instanceSettings;
        this.plugins = [];

        const actionsOnGoogle = require('actions-on-google');
        this.app = actionsOnGoogle.smarthome({
            debug: true,
            jwt: instanceSettings.requestJwt
        });
    }

    getApp() {
        return this.app;
    }

    async getPlugins() {
        this.adapter.log.debug('getPlugins...');
        // The below really should be plugable modules so that each ioBroker adapter
        // can add it's own logic (as only each adapter can know it's devices and how
        // they should map to Google Home).

        // Anyhow, start with Loxone...
        const GSHLoxone = require('./gshLoxone.js');
        const gshLoxone = new GSHLoxone(this.adapter, this.instanceSettings, this.app);
        gshLoxone.init();
        this.plugins.push(gshLoxone);
    }

    async getDevices() {
        this.adapter.log.debug('GoogleSmartHomeApp getDevices...');
        const devices = [];
        // TODO: Iterate over all plugins
        const pDevs = await this.plugins[0].getDevices();
        devices.push(...pDevs);
        this.adapter.log.debug('getDevices returning: ' + JSON.stringify(devices));
        return devices;
    }

    async requestSync() {
        this.adapter.log.debug('Requesting sync');
        this.app.requestSync(this.instanceSettings.agentUserId)
            .then(() => {
                this.adapter.log.debug('requestSync done');
            })
            .catch(() => {
                this.adapter.log.error('requestSync failed');
            });
    }

    async onSync(body) {
        this.adapter.log.debug('onSync...');
        const devices = await this.getDevices();
        return {
            requestId: body.requestId,
            payload: {
                agentUserId: this.instanceSettings.agentUserId,
                devices: devices
            }
        };
    }

    async onExecute(body) {
        this.adapter.log.debug('onExecute...');
        const { requestId } = body;
        // Execution results are grouped by status
        const result = {
            ids: ['Light'],
            status: 'SUCCESS',
            states: {
                online: true,
            },
        };

        // TODO: dummy response
        return {
            requestId: requestId,
            payload: {
                commands: [result],
            },
        };
    }

    async init() {
        // For some reason we cannot just reference this.onSync function here
        // and have to wrap it in an anonymous function.
        // TODO: figure out why?
        this.app.onSync((body) => {
            return this.onSync(body);
        });
        this.app.onExecute((body) => {
            return this.onExecute(body);
        });
        this.getPlugins();
        this.requestSync();
    }
}

module.exports = GoogleSmartHomeApp;