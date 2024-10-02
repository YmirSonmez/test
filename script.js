class TomarketBot {
    constructor() {
        this.config = {
            interval: 300,
            play_game: false,
            game_point: { low: 1, high: 10 },
            additional_time: { min: 60, max: 300 }
        };
        this.logContainer = document.getElementById('log');
        this.headers = {
            "host": "api-web.tomarket.ai",
            "connection": "keep-alive",
            "accept": "application/json, text/plain, */*",
            "user-agent": "Mozilla/5.0 (Linux; Android 10; Redmi 4A / 5A Build/QQ3A.200805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/86.0.4240.185 Mobile Safari/537.36",
            "content-type": "application/json",
            "origin": "https://mini-app.tomarket.ai",
            "x-requested-with": "tw.nekomimi.nekogram",
            "sec-fetch-site": "same-site",
            "sec-fetch-mode": "cors",
            "sec-fetch-dest": "empty",
            "referer": "https://mini-app.tomarket.ai/",
            "accept-language": "en-US,en;q=0.9",
        };
        this.proxy = null;
    }

    parseQueryString(data) {
        return Object.fromEntries(new URLSearchParams(data));
    }

    setProxy(proxy) {
        this.proxy = proxy;
    }

    setAuthorization(auth) {
        this.headers["authorization"] = auth;
    }

    delAuthorization() {
        delete this.headers["authorization"];
    }

    async login(data) {
        const url = "https://api-web.tomarket.ai/tomarket-game/v1/user/login";
        const body = JSON.stringify({
            "init_data": data,
            "invite_code": "",
        });
        this.delAuthorization();
        const res = await this.http(url, this.headers, body);
        if (res.status !== 200) {
            this.log("Failed fetch token authorization, check console for details!");
            return null;
        }
        const responseData = await res.json();
        const token = responseData.data.access_token;
        if (!token) {
            this.log("Failed fetch token authorization, check console for details!");
            return null;
        }
        return token;
    }

    async startFarming() {
        const data = JSON.stringify({"game_id": "53b22103-c7ff-413d-bc63-20f6fb806a07"});
        const url = "https://api-web.tomarket.ai/tomarket-game/v1/farm/start";
        const res = await this.http(url, this.headers, data);
        if (res.status !== 200) {
            this.log("Failed start farming, check console for details!");
            return false;
        }
        const responseData = await res.json();
        const endFarming = responseData.data.end_at;
        const formatEndFarming = new Date(endFarming * 1000).toISOString().split('.')[0].replace('T', ' ');
        this.log(`Success start farming! End at: ${formatEndFarming}`);
    }

    async endFarming() {
        const data = JSON.stringify({"game_id": "53b22103-c7ff-413d-bc63-20f6fb806a07"});
        const url = "https://api-web.tomarket.ai/tomarket-game/v1/farm/claim";
        const res = await this.http(url, this.headers, data);
        if (res.status !== 200) {
            this.log("Failed end farming, check console for details!");
            return false;
        }
        const responseData = await res.json();
        const points = responseData.data.claim_this_time;
        this.log(`Success claim farming! Reward: ${points}`);
    }

    async dailyClaim() {
        const url = "https://api-web.tomarket.ai/tomarket-game/v1/daily/claim";
        const data = JSON.stringify({"game_id": "fa873d13-d831-4d6f-8aee-9cff7a1d0db1"});
        const res = await this.http(url, this.headers, data);
        if (res.status !== 200) {
            this.log("Failed claim daily sign, check console for details!");
            return false;
        }
        const responseData = await res.json();
        if (typeof responseData.data === 'string') {
            this.log("Maybe already signed in");
            return;
        }
        const points = responseData.data.today_points;
        this.log(`Success claim daily sign reward: ${points}!`);
    }

    async playGameFunc(amountPass) {
        const dataGame = JSON.stringify({"game_id": "59bcd12e-04e2-404c-a172-311a0084587d"});
        const startUrl = "https://api-web.tomarket.ai/tomarket-game/v1/game/play";
        const claimUrl = "https://api-web.tomarket.ai/tomarket-game/v1/game/claim";
        for (let i = 0; i < amountPass; i++) {
            const res = await this.http(startUrl, this.headers, dataGame);
            if (res.status !== 200) {
                this.log("Failed start game!");
                return;
            }
            this.log("Success start game!");
            await this.sleep(30000);
            const point = Math.floor(Math.random() * (this.config.game_point.high - this.config.game_point.low + 1)) + this.config.game_point.low;
            const dataClaim = JSON.stringify({"game_id": "59bcd12e-04e2-404c-a172-311a0084587d", "points": point});
            const claimRes = await this.http(claimUrl, this.headers, dataClaim);
            if (claimRes.status !== 200) {
                this.log("Failed claim game point!");
                continue;
            }
            this.log(`Success claim game point: ${point}`);
        }
    }

    async getBalance() {
        const url = "https://api-web.tomarket.ai/tomarket-game/v1/user/balance";
        while (true) {
            const res = await this.http(url, this.headers);
            if (res.status !== 200) {
                this.log("Failed fetch balance!");
                continue;
            }
            const responseData = await res.json();
            const data = responseData.data;
            if (!data) {
                this.log("Failed get data!");
                return null;
            }
            const timestamp = data.timestamp;
            const balance = data.available_balance;
            this.log(`Balance: ${balance}`);
            if (!data.daily) {
                await this.dailyClaim();
                continue;
            }
            const nextDaily = data.daily.next_check_ts;
            if (timestamp > nextDaily) {
                await this.dailyClaim();
            }
            if (!data.farming) {
                this.log("Farming not started!");
                await this.startFarming();
                continue;
            }
            const endFarming = data.farming.end_at;
            const formatEndFarming = new Date(endFarming * 1000).toISOString().split('.')[0].replace('T', ' ');
            if (timestamp > endFarming) {
                await this.endFarming();
                continue;
            }
            this.log(`Not time to claim! End farming at: ${formatEndFarming}`);
            if (this.config.play_game) {
                this.log("Auto play game is enabled!");
                const playPass = data.play_passes;
                this.log(`Game ticket: ${playPass}`);
                if (parseInt(playPass) > 0) {
                    await this.playGameFunc(playPass);
                    continue;
                }
            }
            const next = endFarming - timestamp;
            return next + Math.floor(Math.random() * (this.config.additional_time.max - this.config.additional_time.min + 1)) + this.config.additional_time.min;
        }
    }

    async http(url, headers, data = null) {
        const options = {
            method: data ? 'POST' : 'GET',
            headers: headers,
            body: data
        };
        if (this.proxy) {
            options.proxy = this.proxy;
        }
        try {
            const response = await fetch(url, options);
            console.log(`${response.status} - ${await response.text()}`);
            return response;
        } catch (error) {
            console.error('HTTP request failed:', error);
            throw error;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    log(message) {
        const now = new Date().toISOString().split('T')[1].split('.')[0];
        const logMessage = `[${now}] ${message}`;
        console.log(logMessage);
        const logEntry = document.createElement('div');
        logEntry.textContent = logMessage;
        this.logContainer.appendChild(logEntry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    isExpired(token) {
        const [, payload] = token.split('.');
        const decodedPayload = JSON.parse(atob(payload));
        return Date.now() / 1000 > decodedPayload.exp;
    }

    async start(accounts) {
        this.log('Bot started');
        for (const account of accounts) {
            const parser = this.parseQueryString(account);
            const user = JSON.parse(parser.user);
            const id = user.id;
            this.log(`Processing account: ${user.first_name}`);

            let token = localStorage.getItem(`token_${id}`);
            if (!token || this.isExpired(token)) {
                token = await this.login(account);
                if (!token) continue;
                localStorage.setItem(`token_${id}`, token);
            }

            this.setAuthorization(token);
            const nextRun = await this.getBalance();
            if (nextRun) {
                this.log(`Next run in ${nextRun} seconds`);
                await this.sleep(nextRun * 1000);
            }
        }
        this.log('All accounts processed. Restarting...');
        this.start(accounts);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const bot = new TomarketBot();
    const startButton = document.getElementById('start-bot');

    startButton.addEventListener('click', () => {
        bot.config.interval = parseInt(document.getElementById('interval').value);
        bot.config.play_game = document.getElementById('play-game').checked;
        bot.config.game_point.low = parseInt(document.getElementById('game-low-point').value);
        bot.config.game_point.high = parseInt(document.getElementById('game-high-point').value);
        bot.config.additional_time.min = parseInt(document.getElementById('add-time-min').value);
        bot.config.additional_time.max = parseInt(document.getElementById('add-time-max').value);

        const proxyInput = document.getElementById('proxy').value;
        if (proxyInput) {
            bot.setProxy(proxyInput);
        }

        const accounts = document.getElementById('data').value.split('\n').filter(line => line.trim() !== '');

        bot.start(accounts);
        startButton.disabled = true;
    });
});