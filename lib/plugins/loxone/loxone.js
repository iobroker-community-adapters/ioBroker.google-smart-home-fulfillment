function getRoom(device) {
    // The first value of the enums object
    return device.enums[Object.keys(device.enums)[0]];
}

function executeError(id) {
    return {
        ids: [id],
        status: 'ERROR',
        errorCode: 'actionNotAvailable'
    };
}

function executeSuccess(id) {
    return {
        ids: [id],
        status: 'SUCCESS'
    };
}

class Loxone {
    constructor(adapter, instanceSettings, app) {
        this.adapter = adapter;
        this.instanceSettings = instanceSettings;
        this.app = app;
    }

    async lightDeviceBuilder(id, device) {
        // Main device - simply for on/off function
        this.devices[id] = {
            handlers: {
                onExecute: (id, execution) => { return this.lightExecuteHandler(id, execution); },
                onQuery: (id) => { return this.lightQueryHandler(id); }
            },
            gDevice: {
                id: id,
                type: 'action.devices.types.LIGHT',
                traits: ['action.devices.traits.OnOff'],
                name: { name: device.common.name },
                willReportState: false, // Change to true when we subscribe and send changes
                roomHint: getRoom(device)
            }
        };

        // Now get list of moods and create a number of scene devices
        const moodList = await this.adapter.getForeignStateAsync(`${id}.moodList`);
        this.adapter.log.debug(`moodList for ${id}: ${moodList.val}`);
        // This isn't a Loxone ID, just an internal ID so we can keep track as
        // don't want to use raw strings in device IDs.
        let moodId = 0;
        for (const mood of moodList.val) {
            // Don't bother with 'Off'...
            if (mood == 'Off') continue;

            // ... or create a SCENE device for this mood
            const subId = `${id}.${moodId}`;
            this.devices[subId] = {
                handlers: {
                    onExecute: (subId, execution) => { return this.lightExecuteHandler(subId, execution); },
                },
                moodName: mood,
                parentId: id,
                gDevice: {
                    id: subId,
                    type: 'action.devices.types.SCENE',
                    traits: ['action.devices.traits.Scene'],
                    name: { name: mood },
                    willReportState: false,
                    roomHint: getRoom(device)
                }
            };
            moodId++;
        }
    }

    async lightExecuteHandler(id, execution) {
        this.adapter.log.debug(`lightExecuteHandler for ${id}...`);
        switch (execution[0].command) {
            case 'action.devices.commands.OnOff':
                // TODO: this should probably use the masterValue on/off states but they seem broken
                if (execution[0].params.on) {
                    await this.adapter.setForeignStateAsync(`${id}.activeMoods`, 'Bright');
                } else {
                    await this.adapter.setForeignStateAsync(`${id}.activeMoods`, 'Off');
                }
                break;
            case 'action.devices.commands.ActivateScene':
                if (!execution[0].params.deactivate) {
                    await this.adapter.setForeignStateAsync(`${this.devices[id].parentId}.activeMoods`, this.devices[id].moodName);
                }
                break;
            default:
                this.adapter.log.error(`lightExecuteHandler doesn't know how to execute ${execution[0].command}`);
                return executeError(id);
        }
        return executeSuccess(id);
    }

    async lightQueryHandler(id) {
        this.adapter.log.debug(`lightQueryHandler for ${id}...`);
        // TODO: this should probably use the masterValue on/off states but they seem broken
        const activeMoods = await this.adapter.getForeignStateAsync(`${id}.activeMoods`);
        const on = (activeMoods.val == 'Off') ? false : true;
        return {
            [id]: {
                online: true,
                status: 'SUCCESS',
                on: on
            }
        };
    }

    async shutterExecuteHandler(id, execution) {
        this.adapter.log.debug(`shutterExecuteHandler for ${id}...`);
        switch (execution[0].command) {
            case 'action.devices.commands.OpenClose':
                this.adapter.setForeignState(`${id}.position`, 100 - execution[0].params.openPercent);
                break;
            case 'action.devices.commands.StartStop':
                if (!execution[0].params.start) {
                    let stop = false;
                    const down = await this.adapter.getForeignStateAsync(`${id}.down`);
                    if (down.val) {
                        stop = true;
                    } else {
                        const up = await this.adapter.getForeignStateAsync(`${id}.down`);
                        stop = up.val;
                    }

                    if (stop) {
                        // Just hit any button to stop movement
                        await this.adapter.setForeignStateAsync(`${id}.fullUp`, true);
                    }
                }
                break;
            default:
                this.adapter.error(`shutterExecuteHandler doesn't know how to execute ${execution[0].command}`);
                return executeError(id);
        }
        return executeSuccess(id);
    }

    async shutterQueryHandler(id) {
        this.adapter.log.debug(`shutterQueryHandler for ${id}...`);
        const position = await this.adapter.getForeignStateAsync(`${id}.position`);

        let isRunning = false;
        const down = await this.adapter.getForeignStateAsync(`${id}.down`);
        if (down.val) {
            isRunning = true;
        } else {
            const up = await this.adapter.getForeignStateAsync(`${id}.down`);
            isRunning = up.val;
        }
        return {
            [id]: {
                online: true,
                status: 'SUCCESS',
                openState: {
                    openPercent: 100 - position.val,
                    openDirection: 'UP',
                },
                isRunning: isRunning
            }
        };
    }

    async getDevices() {
        this.adapter.log.debug('GSHLoxone getDevices...');

        // Remember the list of devices we create so when the exec handler
        // calls come in the ID can be used to determine which device type
        // this is.
        this.devices = [];

        const srcObjects = await this.adapter.getForeignObjectsAsync('loxone.0.*', 'device', ['rooms']);

        // Loop over states looking for devices we know how to convert to Google Actions
        for (const [id, device] of Object.entries(srcObjects)) {
            switch (device.native.type) {
                case 'LightControllerV2':
                    this.adapter.log.debug(`Found ${device.native.type} ${id}`);
                    await this.lightDeviceBuilder(id, device);
                    break;

                case 'Jalousie':
                    this.adapter.log.debug(`Found ${device.native.type} ${id}`);
                    this.devices[id] = {
                        handlers: {
                            onExecute: (id, execution) => { return this.shutterExecuteHandler(id, execution); },
                            // Supply a query handler even though this appears never to be called :()
                            onQuery: (id) => { return this.shutterQueryHandler(id); }
                        },
                        gDevice: {
                            id: id,
                            type: 'action.devices.types.SHUTTER',
                            traits: ['action.devices.traits.OpenClose', 'action.devices.traits.StartStop'],
                            name: { name: device.common.name },
                            willReportState: false, // Change to true when we subscribe and send changes
                            roomHint: getRoom(device),
                            attributes: {
                                openDirection: ['UP'],
                                discreteOnlyOpenClose: true
                            }
                        }
                    };
                    break;

                default:
                    this.adapter.log.debug(`Skipping ${device.native.type} ${id}`);
            }
        }

        this.adapter.log.debug('GSHLoxone getDevices returning: ' + JSON.stringify(this.devices));
        return this.devices;
    }

    async init() {
        this.adapter.log.debug('GSHLoxone init...');
        // TODO: Later on we will loop through devices and subscribe to events so we can call reportState
        //const devices = await this.buildDevices();
    }
}

module.exports = Loxone;
