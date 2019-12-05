import fs from 'fs';
import ApiModule from "../ApiModule";
import ping from 'tcp-ping';
import credentials from '../../res/credentials'
import Telegram from "./Telegram";

export default class UpCheckerModule extends ApiModule {
    constructor() {
        super();

        this.telegram = new Telegram();
        this.telegram.setToken(credentials.token);

        this.data = {
            today: '',
            todayRecords: 0,
            historyLength: 7,
            endpoints: [
                {
                    name: 'NGINX Server',
                    url: '80.114.182.230',
                    port: 443,
                    upTimes: [],
                    up: true,
                },
                {
                    name: 'API Server',
                    url: '80.114.182.230',
                    port: 3000,
                    upTimes: [],
                    up: true,
                },
                {
                    name: 'Content Management System',
                    url: '80.114.182.230',
                    port: 4040,
                    upTimes: [],
                    up: true,
                },
            ]
        };

        this.today = '';
        this.historyFile = 'history.json';
        this.checkInterval = 2000;

        fs.access(this.historyFile, fs.constants.R_OK, async err => {
            if (err) {
                console.log("Creating file: " + this.historyFile);
                this.exportEndpoints(this.data);
            } else {
                console.log("Importing from file: " + this.historyFile);
                this.data = await this.importEndpoints();
            }
            this.startChecking();
        });
    }

    setRoutes(app) {
        app.get('/uptime/', async (req, res) => {
            res.send(this.data);
        });
    }

    importEndpoints() {
        return new Promise((resolve, reject) => {
            fs.readFile(this.historyFile, (err, fileText) => {
                if (err) console.warn(err);
                try {
                    let data = JSON.parse(fileText.toString());
                    resolve(data);
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    exportEndpoints(data) {
        fs.writeFile(this.historyFile, JSON.stringify(data), {flag: 'w'}, err => {
            if (err) console.warn(err);
        });
    }

    startChecking() {
        console.log("Initializing");
        this.checkEndpoints(this.data);
        setInterval(() => this.checkEndpoints(this.data), this.checkInterval);
    }

    singlePing(endpoint) {
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
                    resolve({up: true, ping: data.avg});
            })
        })
    }

    async checkEndpoints(data) {
        let endpoints = data.endpoints;
        let pings = await Promise.all(endpoints.map(e => this.singlePing(e)));

        let date = new Date().toLocaleDateString();
        if (data.today !== date) {
            data.today = date;
            data.todayRecords = 0;

            endpoints.forEach(endpoint => {
                //Remove oldest day;
                endpoint.upTimes.splice(0, 1);
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
                this.telegram.sendMessage(`😱 ${endpoint.name} is down! 😱`, credentials.chatId);
            }
            if (!endpoint.up && up) {
                console.log(`${endpoint.name} IS BACK UP! SENDING TELEGRAM MESSAGE!`);
                this.telegram.sendMessage(`👌 ${endpoint.name} is up! 👌`, credentials.chatId);
            }
            endpoint.up = up;
        }
        data.todayRecords++;
        this.exportEndpoints(data);
    }
}