import fs from 'fs';
import ApiModule from "../ApiModule.mjs";
import ping from 'tcp-ping';
import credentials from '../../res/credentials.json'
import Telegram from "./Telegram.mjs";

import domainPing from "domain-ping";

export default class UpCheckerModule extends ApiModule {
    constructor() {
        super();

        this.telegram = new Telegram();
        this.telegram.setToken(credentials.token);

        this.telegram.sendMessage("Hello world")

        this.data = {
            today: '',
            todayRecords: 0,
            historyLength: 7,
            endpoints: [
                {
                    name: 'Github Pages',
                    url: 'ruurd.dev',
                    upTimes: [],
                    up: true,
                },
                {
                    name: 'API Server',
                    url: 'api.ruurd.dev',
                    upTimes: [],
                    up: true,
                },
                {
                    name: 'Plex',
                    url: 'plex.ruurd.dev',
                    upTimes: [],
                    up: true,
                },
                {
                    name: 'Sonarr',
                    url: 'sonarr.ruurd.dev',
                    upTimes: [],
                    up: true,
                },
                {
                    name: 'Radarr',
                    url: 'radarr.ruurd.dev',
                    upTimes: [],
                    up: true,
                },
                {
                    name: 'Deluge',
                    url: 'deluge.ruurd.dev',
                    upTimes: [],
                    up: true,
                },
            ]
        };

        this.checkInterval = 2000;
        setInterval(() => {
            this.checkEndpoints(this.data);
        }, this.checkInterval);
    }

    setRoutes(app) {
        app.get('/', async (req, res) => {
            res.send(this.data);
        });
    }

    async singlePing(endpoint) {
        try {
            let response = await domainPing(endpoint.url);
            return {up: response.ping};
        } catch (e) {
            console.warn(e);
            return {up: false};
        }


        return new Promise((resolve, reject) => {
            ping.ping({
                address: endpoint.url,
                port: endpoint.port,
                timeout: 2000,
                attempts: 3
            }, (err, data) => {
                if (err)
                    reject(err);
                if (isNaN(data.avg))
                    resolve({up: false});
                else
                    resolve({up: true});
            })
        })
    }

    async checkEndpoints(data) {
        let endpoints = data.endpoints;
        let pings = await Promise.all(endpoints.map(e => this.singlePing(e)));
        let downEndpoints = [];
        let upEndpoints = [];

        let date = new Date().toLocaleDateString();
        if (data.today !== date) {
            data.today = date;
            data.todayRecords = 0;

            endpoints.forEach(endpoint => {
                //Remove oldest day;
                // endpoint.upTimes.splice(0, 1);
                //Add today
                endpoint.upTimes.push({
                    date, up: 1
                });
                if (endpoint.upTimes.length > data.historyLength) {
                    endpoint.upTimes.splice(0, 1);
                    //Remove oldest data
                }
            });
        }

        for (let i = 0; i < endpoints.length; i++) {
            let endpoint = endpoints[i];
            let {up} = pings[i];
            let todayUp = endpoint.upTimes[endpoint.upTimes.length - 1];
            let newUp = data.todayRecords * todayUp.up + up;
            todayUp.up = newUp / (data.todayRecords + 1);
            if (endpoint.up && !up) {
                console.log(`${endpoint.name} WENT DOWN! SENDING TELEGRAM MESSAGE!`);
                downEndpoints.push(endpoint.name);
            }
            if (!endpoint.up && up) {
                console.log(`${endpoint.name} IS BACK UP! SENDING TELEGRAM MESSAGE!`);
                upEndpoints.push(endpoint.name);
            }
            endpoint.up = up;
        }
        let statusText = '';
        if (upEndpoints.length > 0 || downEndpoints.length > 0)
            statusText = 'Server status change:\n';
        if (upEndpoints.length > 0) {
            statusText += '\n👌UP👌UP👌UPup👌:\n\n';
            statusText += upEndpoints.join('\n');
        }
        if (downEndpoints.length > 0) {
            statusText += '\n😱DOWN😱DOWN😱DOWN😱:\n\n';
            statusText += downEndpoints.join('\n');
        }
        if (statusText.length > 0)
            this.telegram.sendMessage(statusText, credentials.chatId);
        data.todayRecords++;
    }
}