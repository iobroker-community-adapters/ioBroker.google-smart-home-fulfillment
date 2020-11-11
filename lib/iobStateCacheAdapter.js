// Variables that we want to be common to all classes created but set from caller.
// TODO: is there a better way to do this?
const adapterCtx = {};
const stateBase = 'OAuth.cache.';

function grantKeyFor(id) {
    return 'grant.' + id;
}

function sessionUidKeyFor(id) {
    return 'sessionUid.' + id;
}

function userCodeKeyFor(userCode) {
    return 'userCode.' + userCode;
}

// Actual storage class
class iobStateCacheAdapter {
    constructor(model) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter adapterCache creating for ' + model);
        this.model = model;
    }

    stateIdFor(key) {
        return stateBase + key;
    }

    key(id) {
        return `${this.model}.${id}`;
    }

    storageSet(key, value, expiresIn) {
        const stateId = this.stateIdFor(key);
        const state = { val: JSON.stringify(value), ack: true };
        if (expiresIn) {
            state.expire = expiresIn;
            adapterCtx.adapter.log.debug('iobStateCacheAdapter setState: ' + stateId + ' (expires in ' + state.expire + ')');
        } else {
            adapterCtx.adapter.log.debug('iobStateCacheAdapter setState: ' + stateId);
        }
        adapterCtx.adapter.setState(stateId, state, function(err) {
            if (err) {
                adapterCtx.adapter.log.error('iobStateCacheAdapter failed to setState ' + stateId + ' : ' + err);
            }
        });
    }

    storageGet(key) {
        const stateId = this.stateIdFor(key);
        adapterCtx.adapter.log.debug('iobStateCacheAdapter getState: ' + stateId);
        return new Promise(function (resolve, reject) {
            adapterCtx.adapter.getState(stateId, function (err, state) {
                if (err) {
                    adapterCtx.adapter.log.error('iobStateCacheAdapter failed to getState ' + stateId + ' : ' + err);
                    reject(err);
                } else {
                    if (state) {
                        resolve(JSON.parse(state.val));
                    } else {
                        adapterCtx.adapter.log.debug('iobStateCacheAdapter ID not found: ' + stateId);
                        resolve();
                    }
                }
            });
        });
    }

    async set(key, value) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter set: ' + key + ' for ' + this.model);
        this.storageSet(key, value);
    }

    async get(key) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter get: ' + key + ' for ' + this.model);
    }

    async clear(key) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter get: ' + key + ' for ' + this.model);
    }

    async destroy(id) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter destroy: ' + id + ' for ' + this.model);
    }

    async consume(id) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter consume: ' + id + ' for ' + this.model);
    }

    async find(id) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter find: ' + id + ' for ' + this.model);
        return this.storageGet(this.key(id));
    }

    async findByUid(uid) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter findByUid: ' + uid + ' for ' + this.model);
        const id = await this.storageGet(sessionUidKeyFor(uid));
        return this.find(id);
    }

    async findByUserCode(userCode) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter findByUserCode: ' + userCode + ' for ' + this.model);
    }

    async upsert(id, payload, expiresIn) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter upsert: ' + id + ' for ' + this.model);
        const key = this.key(id);

        if (this.model === 'Session') {
            this.storageSet(sessionUidKeyFor(payload.uid), id, expiresIn);
        }

        const { grantId, userCode } = payload;
        if (grantId) {
            adapterCtx.adapter.log.debug('iobStateCacheAdapter grantId: ' + grantId);
            const grantKey = grantKeyFor(grantId);
            const grant = await this.storageGet(grantKey);
            if (!grant) {
                this.storageSet(grantKey, [key]);
            } else {
                grant.push(key);
            }
        }

        if (userCode) {
            adapterCtx.adapter.log.debug('iobStateCacheAdapter userCode: ' + userCode);
            this.storageSet(userCodeKeyFor(userCode), id, expiresIn);
        }

        this.storageSet(key, payload, expiresIn);
    }

    async revokeByGrantId(grantId) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter revokeByGrantId: ' + grantId + ' for ' + this.model);
    }

    static setCtx(adapter, instanceSettings) {
        adapterCtx.adapter = adapter;
        adapterCtx.instanceSettings = instanceSettings;
        adapterCtx.adapter.log.debug('iobStateCacheAdapter setCtx done');
    }
}

module.exports = iobStateCacheAdapter;