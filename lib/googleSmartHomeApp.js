class GoogleSmartHomeApp {
    getApp() {
        return this.app;
    }

    requestSync() {
        this.adapter.log.debug('Requesting sync');
        this.setSyncTimer(60);
        this.app.requestSync(this.instanceSettings.agentUserId)
            .then((res) => {
                this.adapter.log.debug('requestSync done:' + JSON.stringify(res));
            })
            .catch((res) => {
                this.adapter.log.error('requestSync failed:' + JSON.stringify(res));
            });
    }

    setSyncTimer(seconds) {
        this.adapter.log.debug('Setting syncTimer: ' + seconds + 's');
        clearTimeout(this.syncTimer);
        const that = this;
        this.syncTimer = setTimeout(function () {
            that.requestSync();
        }, 1000 * seconds);
    }

    constructor(adapter, instanceSettings) {
        this.adapter = adapter;
        this.instanceSettings = instanceSettings;

        this.adapter.log.debug('GoogleSmartHomeApp: constructor');
        console.log('this.instanceSettings.agentUserId: ' + this.instanceSettings.agentUserId);

        const actionsOnGoogle = require('actions-on-google');
        this.app = actionsOnGoogle.smarthome({
            debug: true,
            jwt: instanceSettings.requestJwt
        });

        // So call it 5s after startup...
        this.setSyncTimer(5);

        this.app.onSync((body) => {
            this.adapter.log.debug('onSync...');
            this.setSyncTimer(60);

            // Test payload
            return {
                requestId: body.requestId,
                payload: {
                    agentUserId: this.instanceSettings.agentUserId,
                    devices: [{
                        id: 'VR1',
                        type: 'action.devices.types.SHUTTER',
                        traits: ['action.devices.traits.OpenClose'],
                        name: { name: 'VR1', nicknames: ['Kitchen Shutter'] },
                        willReportState: false,
                        'attributes': {
                            commandOnlyOpenClose: true
                        }
                    }]
                }
            };
        });

        this.app.onExecute(async (body) => {
            this.adapter.log.debug('onExecute...');
            const { requestId } = body;
            // Test result
            const result = {
                ids: ['Light'],
                status: 'SUCCESS',
                states: {
                    online: true,
                },
            };
/*
            const executePromises = [];
            const intent = body.inputs[0];
            for (const command of intent.payload.commands) {
                for (const device of command.devices) {
                    for (const execution of command.execution) {
                        executePromises.push(
                            updateDevice(execution, device.id)
                                .catch(() => console.error(`Unable to update ${device.id}`)) //jshint ignore:line
                        );
                    }
                }
            }

            console.log("Done building promises");
*/
            return {
                requestId: requestId,
                payload: {
                    commands: [result],
                },
            };
        });
    }
}

module.exports = GoogleSmartHomeApp;