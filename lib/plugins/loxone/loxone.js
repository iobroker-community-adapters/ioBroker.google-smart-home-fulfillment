// What moods to activate when a light is turned on/off
// TODO: maybe these should be config options?
const moodOn = 'Bright';
const moodOff = 'Off';

// Enums to fetch when loading the object tree & functions to decode them
const objectEnums = ['rooms', 'functions'];
function getRoom(device) {
    // The first value of the enums object
    return device.enums[Object.keys(device.enums)[0]];
}
function getFunction(device) {
    // The first value of the enums object
    return device.enums[Object.keys(device.enums)[1]];
}

// Various return objects
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

// Helper function
function removeFromArray(array, element) {
    const index = array.indexOf(element);
    if (index > -1) {
        array.splice(index, 1);
    }
}

// Main class to return
class Loxone {
    constructor(adapter, instanceSettings, app) {
        this.adapter = adapter;
        this.instanceSettings = instanceSettings;
        this.app = app;

        // Remember the list of devices we create so when handler calls
        // come in the ID can be used to determine which device type
        // this is.
        this.devices = [];
    }

    enabled() {
        return this.instanceSettings.pluginsLoxoneEnabled;
    }

    async lightDeviceBuilder(id, device) {
        // Main device - simply for on/off function
        this.devices[id] = {
            handlers: {
                onExecute: this.lightExecuteHandler.bind(this),
                onQuery: this.lightQueryHandler.bind(this)
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
        // TODO: we need to subscribe to the mood list and trigger a sync each
        // time it changes.
        const moodList = await this.adapter.getForeignStateAsync(`${id}.moodList`);
        this.adapter.log.debug(`moodList for ${id}: ${moodList.val}`);
        // This isn't a Loxone ID, just an internal ID so we can keep track as
        // don't want to use raw strings in device IDs.
        let moodId = 0;
        for (const mood of moodList.val) {
            // Don't bother with 'Off'...
            if (mood == moodOff) continue;

            // ... or create a SCENE device for this mood
            const subId = `${id}.${moodId}`;
            this.devices[subId] = {
                handlers: {
                    onExecute: this.lightExecuteHandler.bind(this)
                },
                moodName: mood,
                parentId: id,
                gDevice: {
                    id: subId,
                    type: 'action.devices.types.SCENE',
                    traits: ['action.devices.traits.Scene'],
                    name: { name: mood },
                    willReportState: false,
                    roomHint: getRoom(device),
                    attributes: {
                        sceneReversible: this.instanceSettings.pluginsLoxoneSceneReversible
                    }
                }
            };
            moodId++;
        }
    }

    async lightExecuteHandler(id, execution) {
        this.adapter.log.debug(`lightExecuteHandler for ${id}...`);
        switch (execution[0].command) {
            case 'action.devices.commands.OnOff': {
                // TODO: this should probably use the masterValue on/off states but they seem broken
                if (execution[0].params.on) {
                    await this.adapter.setForeignStateAsync(`${id}.activeMoods`, moodOn);
                } else {
                    await this.adapter.setForeignStateAsync(`${id}.activeMoods`, moodOff);
                }
                break;
            }
            case 'action.devices.commands.ActivateScene': {
                const parentId = this.devices[id].parentId;
                const mood = this.devices[id].moodName;
                // Is this scene reversible?  Use what we told Google rather than
                // global value for safety.
                if (this.devices[id].gDevice.attributes.sceneReversible) {
                    const activeMoodsState = await this.adapter.getForeignStateAsync(`${parentId}.activeMoods`);
                    const activeMoods = activeMoodsState.val;
                    this.adapter.log.debug('activeMoods: ' + JSON.stringify(activeMoods));
                    if (execution[0].params.deactivate) {
                        // Remove the given mood...
                        removeFromArray(activeMoods, mood);
                        // ... and replace with 'Off' if list is now empty
                        if (activeMoods.length == 0) {
                            activeMoods.push(moodOff);
                        }
                    } else {
                        // Remove 'Off' from the list...
                        removeFromArray(activeMoods, moodOff);
                        // ... and add the given mood
                        activeMoods.push(mood);
                    }
                    this.adapter.log.debug('activeMoods are now: ' + JSON.stringify(activeMoods));
                    await this.adapter.setForeignStateAsync(`${parentId}.activeMoods`, activeMoods);
                } else {
                    if (!execution[0].params.deactivate) {
                        await this.adapter.setForeignStateAsync(`${parentId}.activeMoods`, mood);
                    }
                }
                break;
            }
            default: {
                this.adapter.log.error(`lightExecuteHandler doesn't know how to execute ${execution[0].command}`);
                return executeError(id);
            }
        }
        return executeSuccess(id);
    }

    async lightQueryHandler(id) {
        this.adapter.log.debug(`lightQueryHandler for ${id}...`);
        // TODO: this should probably use the masterValue on/off states but they seem broken
        const activeMoods = await this.adapter.getForeignStateAsync(`${id}.activeMoods`);
        const on = (activeMoods.val == moodOff) ? false : true;
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
            case 'action.devices.commands.OpenClose': {
                this.adapter.setForeignState(`${id}.position`, 100 - execution[0].params.openPercent);
                break;
            }
            case 'action.devices.commands.StartStop': {
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
            }
            default: {
                this.adapter.error(`shutterExecuteHandler doesn't know how to execute ${execution[0].command}`);
                return executeError(id);
            }
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

    async switchExecuteHandler(id, execution) {
        this.adapter.log.debug(`switchExecuteHandler for ${id}...`);
        await this.adapter.setForeignStateAsync(`${id}.active`, execution[0].params.on);
        return executeSuccess(id);
    }

    async switchQueryHandler(id) {
        this.adapter.log.debug(`switchQueryHandler for ${id}...`);
        const activeState = await this.adapter.getForeignStateAsync(`${id}.active`);
        return {
            [id]: {
                online: true,
                status: 'SUCCESS',
                on: activeState.val
            }
        };
    }

    async timedSwitchExecuteHandler(id, execution) {
        this.adapter.log.debug(`timedSwitchExecuteHandler for ${id}...`);
        switch (execution[0].command) {
            case 'action.devices.commands.OnOff': {
                if (execution[0].params.on) {
                    await this.adapter.setForeignStateAsync(`${id}.on`, true);
                } else {
                    await this.adapter.setForeignStateAsync(`${id}.off`, true);
                }
                break;
            }

            case 'action.devices.commands.StartStop': {
                if (execution[0].params.start) {
                    // Start the timer
                    await this.adapter.setForeignStateAsync(`${id}.pulse`, true);
                } else {
                    // Stop the timer
                    await this.adapter.setForeignStateAsync(`${id}.off`, true);
                }
                break;
            }
        }
        return executeSuccess(id);
    }

    async timedSwitchQueryHandler(id) {
        this.adapter.log.debug(`timedSwitchQueryHandler for ${id}...`);
        const deactivationDelay = await this.adapter.getForeignStateAsync(`${id}.deactivationDelay`);
        return {
            [id]: {
                online: true,
                status: 'SUCCESS',
                on: (deactivationDelay.val != 0),
                isRunning: (deactivationDelay.val > 0)
            }
        };
    }

    async getDevices() {
        this.adapter.log.debug('Loxone getDevices...');

        // Start with an empty list
        this.devices = [];

        const srcObjects = await this.adapter.getForeignObjectsAsync('loxone.0.*', 'device', objectEnums);

        // Loop over states looking for devices we know how to convert to Google Actions
        for (const [id, device] of Object.entries(srcObjects)) {
            // Skip excluded functions & rooms
            if (this.instanceSettings.pluginsLoxoneExcludeFunctions.indexOf(getFunction(device)) >= 0) {
                this.adapter.log.debug(`Skipping excluded function ${device.native.type} ${id}`);
                continue;
            }
            if (this.instanceSettings.pluginsLoxoneExcludeRooms.indexOf(getRoom(device)) >= 0) {
                this.adapter.log.debug(`Skipping excluded room ${device.native.type} ${id}`);
                continue;
            }

            // Is the type in control or just native?
            const deviceType = (typeof(device.native.type) === 'undefined' ? device.native.control.type : device.native.type);

            switch (deviceType) {
                case 'Jalousie': {
                    this.adapter.log.debug(`Found ${deviceType} ${id}`);
                    this.devices[id] = {
                        handlers: {
                            onExecute: this.shutterExecuteHandler.bind(this),
                            // Supply a query handler even though this appears never to be called :()
                            onQuery: this.shutterQueryHandler.bind(this)
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
                }
                case 'LightControllerV2': {
                    this.adapter.log.debug(`Found ${deviceType} ${id}`);
                    await this.lightDeviceBuilder(id, device);
                    break;
                }
                case 'Switch': {
                    this.adapter.log.debug(`Found ${deviceType} ${id}`);
                    this.devices[id] = {
                        handlers: {
                            onExecute: this.switchExecuteHandler.bind(this),
                            onQuery: this.switchQueryHandler.bind(this)
                        },
                        gDevice: {
                            id: id,
                            type: 'action.devices.types.SWITCH',
                            traits: ['action.devices.traits.OnOff'],
                            name: { name: device.common.name },
                            willReportState: false, // Change to true when we subscribe and send changes
                            roomHint: getRoom(device)
                        }
                    };
                    break;
                }
                case 'TimedSwitch': {
                    this.adapter.log.debug(`Found ${deviceType} ${id}`);
                    this.devices[id] = {
                        handlers: {
                            onExecute: this.timedSwitchExecuteHandler.bind(this),
                            onQuery: this.timedSwitchQueryHandler.bind(this)
                        },
                        gDevice: {
                            id: id,
                            type: 'action.devices.types.SWITCH',
                            traits: ['action.devices.traits.OnOff', 'action.devices.traits.StartStop'],
                            name: { name: device.common.name },
                            willReportState: false, // Change to true when we subscribe and send changes
                            roomHint: getRoom(device)
                        }
                    };
                    break;
                }
                default: {
                    this.adapter.log.debug(`Skipping unhandled ${deviceType} ${id}`);
                }
            }
        }

        this.adapter.log.debug('Loxone getDevices returning: ' + JSON.stringify(this.devices));
        return this.devices;
    }

    connectionStateChange(id, state) {
        this.adapter.log.debug(`Loxone connectionStateChange, state now: ${state.val}`);
        if (state.val) {
            // Loxone has just reconnected - give it a few seconds then trigger a sync with Google Home
            setTimeout((adapter) => {
                adapter.log.debug(`Triggering requestSync`);
                adapter.emit('requestSync');
            }, 5000, this.adapter);
        }
    }

    async init() {
        this.adapter.log.debug('Loxone init...');
        // TODO: Later on we will loop through devices and subscribe to events so we can call reportState
        //const this.devices = await this.buildDevices();

        this.adapter.subscribeForeignStateHandler('loxone.0.info.connection', this.connectionStateChange.bind(this));
    }
}

module.exports = Loxone;
