
"use strict";

const mysql = require("promise-mysql");
const Redis = require('ioredis');
const Promise = require('bluebird');


/**
 * Connect and init database
 * @author Tomas Hujer
 */
class mysqlProc {

    /**
     * Constructor
     * @param o_config_db {object} Db configuration (host, user, db, pass)
     * @param o_config_redis {object} Redis configuration (db, expire)
     * @param o_config_socket_debug {object} Remote debug config (s_url, s_device)
     */
    constructor (o_config_db, o_config_redis, o_config_socket_debug) {

        var self = this;

        self.o_config_db = o_config_db;
        self.o_config_redis = o_config_redis;
        self.o_config_socket_debug = o_config_socket_debug;

        self.b_redis_enabled = (self.o_config_redis !== undefined);
        self.nl_socket_debug_state = false;

        console.log('Redis cache enabled:', self.b_redis_enabled);
        console.log('Socket debug enabled:', self.nl_socket_debug_state);

        self.a_proc_cache = [];

        self.o_pool = mysql.createPool({
            host: o_config_db.host,
            user: o_config_db.user,
            password: o_config_db.pass,
            database: o_config_db.db,
            connectionLimit: 10
        });


        if(self.b_redis_enabled === true) {

            self.o_redis = new Redis(self.o_config_redis);

            self.o_redis.on('connect', () => {
                self.o_redis.select(o_config_redis.db);
                console.log('Redis connected, selected database', o_config_redis.db);
            });

            self.o_redis.on('error', (e) => {
                console.log('MySQL-promises', e)
            });
        }

    }


    /**
     * Returns debug mode state
     * @returns {boolean} True = debug is enabled
     */
    socketDebugEnabled() {
        return this.nl_socket_debug_state;
    }


    /**
     * Start socket remote debug
     */
    socketDebugStart() {

        var self = this;

        return new Promise((resolve, reject) => {

            console.log('socketDebugStart');

            self.io_client = require('socket.io-client')(self.o_config_socket_debug.s_url);

            self.io_client.on('connect', () => {

                console.log('Socket LOG server connected');

                self.nl_socket_debug_state = true;

                self.io_client.emit('message', {
                    s_device: self.o_config_socket_debug.s_device,
                    s_message: 'mysqlProc debug connected'
                });

                resolve(self.nl_socket_debug_state);

            });

            self.io_client.on('disconnect', () => {
                console.log('Socket LOG server disconnected');
            })
        })

    }


    /**
     * Stop remote debug
     */
    socketDebugStop() {

        var self = this;

        console.log('socketDebugStop');

        self.io_client.off('connect');
        self.io_client.off('disconnect');

        self.io_client.disconnect();

        self.nl_socket_debug_state = false;

        return self.nl_socket_debug_state;
    }


    /**
     * Make Redis key from proc name and params
     * @param s_proc_name {string} Stored proc name
     * @param o_param {object} Stored proc params
     * @returns {string}
     */
    static makeRedisCacheKey(s_proc_name, o_param) {

        // Get key for Redis, params as namespaces
        return s_proc_name + ':' + JSON.stringify(o_param)
            .replace(/[{}]+/g, '')
            .replace(/[,]+/g, ':')
            .replace(/["]+/g, '')
            .replace(/\\/g, '')
    }


    /**
     * Call stored proc
     * @param s_proc_name {string} Stored proc name
     * @param o_param {object} Stored proc parameters
     * @param {bool} b_use_cache Enable cache (default = true)
     */
    callProc(s_proc_name, o_param, b_use_cache = true) {

        var self = this;

        return new Promise((resolve, reject) => {

            // If Redis config defined, then try to use Redis cache
            if((self.b_redis_enabled === true) && (b_use_cache === true)) {

                // Get key for Redis, params as namespaces
                var s_key = mysqlProc.makeRedisCacheKey(s_proc_name, o_param);

                console.log('callProc: redis cache GET s_key:', s_key);

                if(self.nl_socket_debug_state) {
                    self.io_client.emit('message', {
                        s_device: self.o_config_socket_debug.s_device,
                        s_message: 'callProc: redis cache GET s_key: ' + s_key
                    })
                }

                self.o_redis.exists(s_key)
                    .then((b_exists) => {

                        var b_cacheable = (s_proc_name[1] === 's');

                        console.log('Is Redis cached?', b_exists,' is cacheable?', b_cacheable);
                        //console.log('Is Redis cached?', b_exists)

                        if(self.nl_socket_debug_state) {
                            self.io_client.emit('message', {
                                s_device: self.o_config_socket_debug.s_device,
                                s_message: 'Is Redis cached?' + b_exists + ' is cacheable?' + b_cacheable
                            })
                        }

                        if((b_exists === 1) && b_cacheable) {

                            //console.time('getCachedItem')

                            // Read item from Redis cache
                            self.o_redis.get(s_key)
                                .then((json_row) => {
                                    //console.timeEnd('getCachedItem')
                                    console.time('parseCachedItem')
                                    resolve(JSON.parse(json_row))
                                    console.timeEnd('parseCachedItem')
                                })
                                .catch((e) => {
                                    console.error(e)
                                    //console.timeEnd('getCachedItem')
                                })

                        } else {
                            //console.time('getMySQLItem')

                            self.callProcMySQL(s_proc_name, o_param, b_cacheable)
                                .then((a_row) => {
                                    //console.timeEnd('getMySQLItem')
                                    resolve(a_row);
                                })
                                .catch((e) => {
                                    //console.timeEnd('getMySQLItem')
                                    console.error(e)
                                })
                        }

                    })
                    .catch((e) => {
                        console.error(e)
                    })

            } else {
                // Redis config not defined, use only MySQL
                console.time('getMySQLItemNoRedis')
                self.callProcMySQL(s_proc_name, o_param)
                    .then((a_row) => {
                        console.timeEnd('getMySQLItemNoRedis')
                        resolve(a_row);
                    })
                    .catch((e) => {
                        console.error(e)
                    })
            }


        })

    }


    /**
     * Store into Redis cache
     * @param s_key {string} Redis key
     * @param a_row {array} Data to cache (stringified because older Redis version)
     */
    setRedisCache(s_key, a_row) {

        const self = this;

        return new Promise((resolve, reject) => {

            console.log('mysqlProc:setRedisCache: s_key:', s_key)

            if(typeof a_row !== 'string') {
                a_row = JSON.stringify(a_row);
            }

            self.o_redis.set(s_key, a_row, 'EX', self.o_config_redis.expire)
                .then((s_result) => {
                    console.log('mysqlProc:setRedisCache: SET', s_result)
                    resolve(s_result);
                })
                .catch((e) => {
                    console.error(e);
                })
        })

    }


    /**
     * Try to get item from cache, if redis not configured, standard array will be used (not expiration)
     * @param s_key {string} Redis key
     * @param b_cacheable {boolean} False = don't cached
     * @returns {bluebird|Bluebird|Bluebird<any>}
     */
    getCache(s_key, b_cacheable) {

        var self = this;

        return new Promise((resolve, reject) => {

            if(b_cacheable === false) {
                reject('Not cacheable');
                return false;
            }

            if(self.b_redis_enabled === true) {

                self.o_redis.exists(s_key)
                    .then((b_exists) => {
                        if(b_exists === 1) {
                            console.log('mysqlProc:getCache: s_key', s_key);
                            self.o_redis.get(s_key)
                                .then((s_json_row) => {
                                    resolve(JSON.parse(s_json_row))
                                })
                                .catch((e) => {
                                    reject(e);
                                })
                        } else {
                            reject('Not exists');
                        }

                    })
                    .catch((e) => {
                        reject(e);
                    })

            } else {
                if(self.a_proc_cache[s_key]) {
                    resolve(self.a_proc_cache[s_key]);
                } else {
                    reject('Key not found');
                }

            }

        })
    }


    /**
     * Store item to cache, if Redis not configured, store value into standard array
     * @param {string} s_key Redis key
     * @param {array} a_param Data array to cache
     */
    setCache(s_key, a_param) {

        var self = this;

        return new Promise((resolve, reject) => {

            if(self.b_redis_enabled === true) {
                // If Redis configured, then use Redis cache
                console.log('mysqlProc:setCache: redis: s_key', s_key, a_param.length);

                self.setRedisCache(s_key, a_param)
                    .then((s_result) => {
                        resolve(s_result)
                    })
                    .catch((e) => {
                        reject(e);
                    })

            } else {
                // No Redis configured, then use standard array
                console.log('mysqlProc:setCache: standard array:', s_key, a_param.length);

                self.a_proc_cache[s_key] = a_param;
                resolve(1)
            }
        })
    }


    /**
     * Flush MySQL cache
     * @returns {Bluebird | Bluebird<any> | bluebird}
     */
    redisFlushCache() {

        var self = this;

        console.log('redisFlushCache');

        return new Promise((resolve, reject) => {

            var nl_count = 0;

            /*
            self.o_redis
                .select(self.o_config_redis.db)
                .flushdb()              // Metoda nenalezena
            ;
            */

            self.o_redis.select(self.o_config_redis.db);

            let o_stream = self.o_redis.scanStream({
                match: '*',
                count: 1000
            });

            o_stream.on('data', (a_key) => {
                console.log('redisFlushCache: keys to delete', a_key.length)

                for(var nl_ix_key in a_key) {
                    self.o_redis.del(a_key[nl_ix_key]);
                }

                nl_count += a_key.length;
            });

            o_stream.on('end', () => {
                resolve(nl_count)
            });

            o_stream.on('error', (err) => {
                reject(err)
            })
        })

    }


    /**
     * Call MySQL proc
     * @param s_proc_name {string} Stored procedure name
     * @param b_cacheable {boolean} False = don't cached
     * @param o_param {object} Stored procedure parameters as properties
     */
    callProcMySQL(s_proc_name, o_param, b_cacheable) {

        var self = this;

        return new Promise((resolve, reject) => {

            var sql = '';

            var s_key_core = mysqlProc.makeRedisCacheKey('ws_core_parameters', {
                s_proc_name: s_proc_name,
                db: self.o_config_db.db
            });

            // TODO: pokud b_cacheable === false, nezapisovat do cache !

            self.getCache(s_key_core, b_cacheable)
                .then((a_param) => {
                    console.log('callProcMySQL:', s_key_core, 'exists in cache', a_param);

                    self.callProcLowLevel(s_proc_name, a_param, o_param)
                        .then((a_row) => {

                            var s_key = mysqlProc.makeRedisCacheKey(s_proc_name, JSON.stringify(o_param));

                            if(self.b_redis_enabled === true) {
                                self.setRedisCache(s_key, a_row)
                                    .then((s_result) => {
                                        console.log('SET result', s_result);
                                        resolve(a_row)
                                    })
                                    .catch((e) => {
                                        console.error(e)
                                    })
                            } else {
                                resolve(a_row);
                            }

                        })
                        .catch((e) => {
                            reject(e);
                        })


                })
                .catch((s_error) => {

                    console.log('callProcMySQL', s_key_core, 'not found cache', s_error);

                    let s_sql = "CALL ws_core_parameters ('" + s_proc_name + "', '" + self.o_config_db.db + "');";

                    console.log(s_sql);

                    self.o_pool.query(s_sql)
                        .then((a_row_core) => {

                            var a_param = a_row_core[0][0].param_list
                                .toString()
                                .replace(/(?:\r\n|\r|\n)/g, '')
                                .replace(/ *\([^)]*\) */g, '')
                                .replace(/[ ]+/g, ' ')
                                .trim()
                                .split(',')
                            ;

                            // If procedure cache disabled
                            if(b_cacheable === false) {
                                // Without Redis cache
                                self.callProcLowLevel(s_proc_name, a_param, o_param)
                                    .then((a_row_item) => {
                                        resolve(a_row_item)
                                    })
                                    .catch((e) => {
                                        console.error(e, s_proc_name, a_param, o_param)
                                        reject(e);
                                    })

                            } else {
                                // With Redis cache
                                console.log('callProcMySQL: setCache', s_key_core, a_param.length)
                                self.setCache(s_key_core, a_param)
                                    .then((b_result) => {

                                        self.callProcLowLevel(s_proc_name, a_param, o_param)
                                            .then((a_row_item) => {
                                                console.log('self.b_redis_enabled', self.b_redis_enabled)

                                                let s_key_item = mysqlProc.makeRedisCacheKey(s_proc_name, JSON.stringify(o_param), a_row_item);

                                                console.log('callProcMySQL: setCache:', s_key_item, a_row_item.length)
                                                self.setCache(s_key_item, a_row_item)
                                                    .then((b_result) => {
                                                        resolve(a_row_item)
                                                    })
                                                    .catch((e) => {
                                                        reject(e);
                                                    })


                                            })
                                            .catch((e) => {
                                                reject(e);
                                            })


                                    })
                                    .catch((e) => {
                                        reject(e)
                                    })

                            }


                        })
                        .catch((e) => {
                            reject(e);
                        });

                })

        })

    }


    /**
     * Create low level SQL procedure call
     * @param s_proc_name {string} Stored procedure name
     * @param a_param {array} Stored proc params from MySQL definition
     * @param o_param {object} Stored procedure params values
     */
    callProcLowLevel(s_proc_name, a_param, o_param) {

        var self = this;

        return new Promise((resolve, reject) => {

            var s_proc_call = 'CALL ' + s_proc_name + ' (';

            //console.log('DEBUG: callProcLowLevel s_proc_name:', s_proc_name, 'a_param:', a_param, 'typeof', typeof a_param, o_param);

            var b_first = true;
            a_param.forEach((s_param_raw) => {

                if(s_param_raw !== "") {

                    var a_param = s_param_raw.trim().split(' ');    // TODO: Try to add this if problem .replace(', ', ',')
                    var s_param_io = a_param[0];
                    var s_param_name = a_param[1].replace('`', '').replace('`', '').substring(1);

                    if (a_param[2]) {
                        var s_param_type = a_param[2].replace(')', '').replace('(', ' ').split(' ')[0];
                    }


                    var a_value = [];

                    //console.log(s_param_io, s_param_name, s_param_type);

                    if (s_param_io == 'IN') {

                        if ((s_param_name in o_param) === true) {

                            var s_value = o_param[s_param_name];

                            console.log(s_value, s_param_type, s_param_name);

                            if (s_value === undefined) {
                                s_value = 'NULL';
                                s_param_type = '';
                            }

                            try {

                                //console.log('--- DEBUG: s_param_name', s_param_name, '(', s_param_type, ')');

                                if(s_param_type === undefined) {
                                    console.error(new Error('Undefined s_param_type in param ' + s_param_name + ', in proc ' + s_proc_name + ',IO:' + s_param_io +', value:' + s_value))
                                    console.error('a_param:', a_param)
                                    console.error('o_param:', o_param)
                                    console.log('--- Error in ', s_param_name, ', proc', s_proc_name)
                                }

                                s_param_type = ((s_param_type !== undefined) ? s_param_type.toLowerCase() : s_param_type);

                                switch (s_param_type) {
                                    case 'datetime':
                                    case 'date':
                                        //a_value.push("'"+dateformat(s_value, 'yyyy-mm-dd H:MM:ss')+"'");
                                        a_value.push("'" + s_value + "'");
                                        break;
                                    case 'int':
                                        a_value.push(parseInt(s_value) || 0);
                                        break;
                                    case 'double':
                                        a_value.push(parseFloat(s_value) || '0');
                                        break;
                                    case 'varchar':
                                    case 'text':
                                        a_value.push("'" + s_value + "'");
                                        break;
                                    default:
                                        a_value.push(s_value);
                                }
                            } catch(e) {
                                console.error('s_param_type parsing error:', s_param_type, e.message, e.stack)
                            }

                        } else {
                            a_value.push('NULL');
                        }

                        a_value.forEach((s_value) => {
                            if (!b_first) {
                                s_proc_call += ',';
                            }
                            b_first = false;
                            s_proc_call += s_value;
                        });
                    }

                }


            });

            s_proc_call += ');';

            console.log('s_proc_call', s_proc_call);

            if(self.nl_socket_debug_state) {
                self.io_client.emit('message', {
                    s_device: self.o_config_socket_debug.s_device,
                    s_message: s_proc_call
                })
            }

            self.o_pool.query(s_proc_call)
                .then((a_row) => {
                    //console.log('callProcLowLevel result', a_row)
                    resolve(a_row);
                })
                .catch((e) => {
                    console.error('SQL ERR ', e, 'in', s_proc_call);
                    reject(e);
                });
        })

    }


}

module.exports = mysqlProc;

