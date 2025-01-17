
import cron from 'node-cron';
import process from 'process';

console.log('NodeVersion', process.versions.node);

import Table from 'cli-table3';

const ENVIROMENT = process.env.NODE_ENV || 'production';
console.log('ENVIROMENT:', ENVIROMENT);

const recipient = {
    email: 'thujer@gmail.com',
    name: 'Tomas Hujer'
}

/* Redis expiration settings [sec] */
const NL_EXPIRE_MYSQL_REDIS_CACHE = 900;    // Redis cache for MySQL ws* procedures

const o_redis_db_list = {
    MYSQL_CACHE: 1,
    APP_CACHE: 2,
};

import { loadJSONConfig } from "./src/class/load_json_config.mjs";

const oEnviroment = await loadJSONConfig(`./config/enviroment_${ENVIROMENT}.json`);

console.log('oEnviroment', oEnviroment);

const oLoggerConfig = await loadJSONConfig('./config/logger.json');
const oMail = await loadJSONConfig('./config/mail.json');

/* App properties */
const oAppPackage = await loadJSONConfig('./package.json');

/* Timestamps */
import moment from 'moment';
moment.locale('cs');

import { syncDailyRecords } from './src/class/sync_daily_records.mjs';
import { syncAlertHistory } from './src/class/sync_alert_history.mjs';
import { syncCalorimeterHistory } from './src/class/sync_calorimeter_history.mjs';

/* MySQL, Redis */
import { MysqlProc } from './src/class/mysql-proc.mjs';

const o_config_mysql = await loadJSONConfig('./config/db.json');
const o_config_redis = await loadJSONConfig('./config/redis.json');

// InfluxDB
const o_config_influx = await loadJSONConfig('./config/influxdb.json');
import { InfluxDB, Point } from '@influxdata/influxdb-client';
const influxDB = new InfluxDB(o_config_influx);

import fs from "fs";
import axios from "axios";
import {htmlToText} from "html-to-text";

function cronLogMessage() {
    console.log('Cron job executed at:', new Date().toLocaleString());
}


class AppSync {

    o_memory_usage = {};

    /**
     * Init app.
     * @constructor
     */
    constructor() {

        const self = this;

        self.initModules()
            .then(() => {})
            .catch((err) => {
                console.error(err);
            });
    }


    async initModules() {

        const self = this;

        // Clone Redis config and append some parameters
        let o_config_redis_cache = o_config_redis;
        o_config_redis_cache.db = o_redis_db_list.MYSQL_CACHE;
        o_config_redis_cache.expire = NL_EXPIRE_MYSQL_REDIS_CACHE;

        let o_config_mysql_debug = {
            s_url: oLoggerConfig.url,
            s_device: oEnviroment.appId,
        };


        try {
            self.o_mysql = await new MysqlProc(o_config_mysql, o_config_redis_cache, o_config_mysql_debug);
        } catch (e) {
            console.error('MySql proc init error', e);
        }
    }


    /**
     * New Mail sender (28.9.2024)
     * @param recipient
     * @param subject
     * @param htmlContent
     * @param textContent
     * @param attachment
     * @returns {Promise<{b_success: boolean}>}
     */
    async sendMail({recipient, subject, htmlContent, textContent, attachment}){

        const o_result = {
            b_success: false
        }

        let o_mail_data = {
            api_key: oMail.apiKey,
            payload: {
                tags: ['Info'],
                to: [recipient],
                sender: {
                    email: '***@visualreg.eu',
                    name: 'VisualReg'
                },
                subject,
                htmlContent,
                textContent,
                headers: {
                    "Content-Type": "text/html;charset=iso-8859-1",
                },
            }
        }

        console.log({o_mail_data});

        if(attachment) {

            console.log('FILE', attachment);

            // Read and encode the file you want to attach
            const filePath = attachment.path;  // Replace with the path to your file
            const fileContent = fs.readFileSync(filePath).toString('base64');

            o_mail_data.payload.attachment = [{ name: attachment.originalname, content: fileContent }];
        }


        try {
            const s_api_url = `https://${oMail.apiUrl}/api/v1/send`;
            const response = await axios.post(s_api_url, {
                params: o_mail_data
            });
            console.log(response.data);
            o_result.b_success = true;

        } catch (err) {
            console.error(err);
            o_result.b_success = false;
        }

        return o_result;
    }


    async runSyncAlertHistory() {

        const self = this;

        cronLogMessage();

        console.time("syncAlertHistory");

        await app.sendMail({
            recipient,
            subject: 'VisualReg - syncAlertHistory - started',
            htmlContent: 'Synchronizace zahájena',
        });

        await syncAlertHistory(self.o_mysql);

        console.timeEnd("syncAlertHistory");

        await app.sendMail({
            recipient,
            subject: 'VisualReg - syncAlertHistory - done',
            htmlContent: 'Synchronizace dokončena',
        });
    }


    async runSyncCalorimeterHistory() {

        const self = this;

        cronLogMessage();

        console.time("syncCalorimeterHistory");

        await app.sendMail({
            recipient,
            subject: 'VisualReg - syncCalorimeterHistory - started',
            htmlContent: 'Synchronizace zahájena',
        });

        await syncCalorimeterHistory(self.o_mysql);
        console.timeEnd("syncCalorimeterHistory");

        await app.sendMail({
            recipient,
            subject: 'VisualReg - syncCalorimeterHistory - done',
            htmlContent: 'Synchronizace dokočena',
        });
    }


    async runSyncDailyRecords({bucket}) {

        const self = this;

        cronLogMessage();

        console.time("syncDailyRecords");

        await app.sendMail({
            recipient,
            subject: 'VisualReg - syncDailyRecords - started',
            htmlContent: 'Synchronizace zahájena',
        });

        await syncDailyRecords({
            o_mysql:self.o_mysql,
            Point,
            influxDB,
            bucket
        });

        console.timeEnd("syncDailyRecords");

        await app.sendMail({
            recipient,
            subject: 'VisualReg - syncDailyRecords - done',
            htmlContent: 'Synchronizace dokončena',
        });
    }


    async runMemStats() {

        const self = this;

        // An example displaying the respective memory
        // usages in megabytes(MB)
        for (const [key, value] of Object.entries(process.memoryUsage())) {

            if(!self.o_memory_usage.hasOwnProperty(key) ||
                (self.o_memory_usage[key] < (value / 1000000))) {
                self.o_memory_usage[key] = (value / 1000000);

                const o_data = {
                    s_key: key,
                    nl_value: Math.round(value / 1000000),
                }

                await self.o_mysql.callProc('put_mem_stats', o_data);
            }
        }
    }


    async cronSetup() {

        const self = this;

        const CRON_SCHEDULE = {
            ALERT_HISTORY:          '00 3 * * *',
            CALORIMETER_HISTORY:    '00 2 * * *',
            DAILY_RECORDS:          '00 1 * * *',
            MEM_STATS:              '*/10 * * * *',
        }

        cron.schedule(CRON_SCHEDULE.ALERT_HISTORY, await self.runSyncAlertHistory);
        cron.schedule(CRON_SCHEDULE.CALORIMETER_HISTORY, await self.runSyncCalorimeterHistory);
        cron.schedule(CRON_SCHEDULE.DAILY_RECORDS, await self.runSyncDailyRecords);
        cron.schedule(CRON_SCHEDULE.MEM_STATS, await self.runMemStats)

        const table = new Table({
            head: ['Name', 'Schedule']
        });

        Object.entries(CRON_SCHEDULE).forEach(([key, value]) => {
            table.push([key, value]);
        });

        console.log('VisualReg SyncApp started');
        console.log(table.toString());
    }
}


const app = new AppSync();

const env_run = process.env.RUN;
const bucket = process.env.BUCKET;

if(env_run) {
    switch(env_run) {
        case 'ALERT_HISTORY':
            await app.runSyncAlertHistory({bucket});
            break;

        case 'CALORIMETER_HISTORY':
            await app.runSyncCalorimeterHistory({bucket});
            break;

        case 'DAILY_RECORDS':
            await app.runSyncDailyRecords({bucket});
            break;

    }
} else {
    await app.cronSetup();
}





