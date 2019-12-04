import express from 'express';
import https from "https";
import http from "http";
import bodyParser from "body-parser";
import cors from "cors";
import fs from 'fs';
import UpCheckerModule from "./up-checker/UpCheckerModule";


class Controller {
    constructor() {
        this.app = express();
        this.app.use(cors());
        this.app.use(bodyParser.json());

        this.modules = [
            new UpCheckerModule(),
        ];
    }

    setRoutes() {
        for (let module of this.modules)
            module.setRoutes(this.app);
    }

    static getHttpsCredentials(key, cert) {
        try {
            return {
                key: fs.readFileSync(key),
                cert: fs.readFileSync(cert),
            }
        } catch (e) {
            return false;
        }
    }

    start(port = 3000, key, cert) {
        let credentials = Controller.getHttpsCredentials(key, cert);
        let server;
        if (credentials) {
            server = https.createServer(credentials, this.app);
        } else {
            server = http.createServer(this.app);
            console.warn('Controller', "Could not get HTTPS credentials, switching to HTTP");
        }
        this.setRoutes();
        server.listen(port, () => console.log('Controller', `${credentials ? 'HTTPS' : 'HTTP'} server listening on port ${port}!`));
    }
}

export default new Controller();