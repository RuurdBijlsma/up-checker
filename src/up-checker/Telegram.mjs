import fetch from 'node-fetch';

export default class Telegram {
    constructor() {
        this.url = `https://api.telegram.org/`
    }

    setToken(token) {
        this.token = token;
        this.url += 'bot' + this.token;
    }

    async getMe() {
        return await this.request('getMe');
    }

    async sendMessage(message, chatId) {
        message = encodeURIComponent(message);
        return await this.request(`sendMessage?text=${message}&chat_id=${chatId}`);
    }

    async request(telegramMethod, method = 'post') {
        let url = this.url + '/' + telegramMethod;
        let response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            // body: JSON.stringify({user, password})
        });
        let text = await response.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            console.log("Could not parse json: ", text);
        }
    }
}