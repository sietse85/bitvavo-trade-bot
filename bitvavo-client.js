let api = require('./node-bitvavo-api.js')().options({
    APIKEY: process.env.BITVAVO_KEY,
    APISECRET: process.env.BITVAVO_SECRET,
    ACCESSWINDOW: process.env.BITVAVO_ACCESS_WINDOW,
    RESTURL: process.env.BITVAVO_REST,
    WSURL: process.env.BITVAVO_WS,
    DEBUGGING: false,
});

let client;

let portfolio = [];
let totalWorth = {balance: 0};
let running = false;
let markets = {};
let pricePrecision = {};
let tradeBot;
let ui;

function init(t, u) {
    client = api;
    tradeBot = t;
    ui = u;

    client.markets({}, (error, response) => {
        response.forEach((market) => {
            pricePrecision[market.market] = market.pricePrecision;
        });
        markets = response;
        client.balance().then(balanceCallBack).catch((e) => {
            console.log(e);
        });
    });
}

function balanceCallBack(response) {
    response.forEach((item) => {
        const m = portfolio.find((m) => m.market === item.symbol + '-EUR');
        if (m === undefined) {
            portfolio.push({
                market: item.symbol + '-EUR',
                balance: item.available,
                bestBid: 0,
                bestAsk: 0,
                balanceEuro: 0,
                lastPrice: 0,
                orders: 0
            });
        } else {
            m.balance = item.available
        }
    });

    if (!running) {
        running = true;
        tradeBot.init(client, portfolio, ui);
        initializeEmitters();
        run();
    }
}

function updatePrice(response) {
    if (running) {
        const m = portfolio.find((m) => m.market === response.market);
        if (response.hasOwnProperty('bestAsk')) {
            m.bestAsk = response.bestAsk;
        }
        if (response.hasOwnProperty('bestBid')) {
            m.bestBid = response.bestBid;
        }
        if (response.hasOwnProperty('lastPrice')) {
            let worthBefore = m.lastPrice * m.balance;
            let worthAfter = response.lastPrice * m.balance;
            m.balanceEuro = renderGreenOrRed(worthBefore, worthAfter, m.market);
            m.worth = worthAfter;
            m.lastPrice = parseFloat(response.lastPrice).toFixed(8).toString();
        }

        portfolio.sort((a, b) => {
            return a.worth > b.worth ? -1 : 1;
        });
    }
}

function renderGreenOrRed(oldValue, newValue, market) {
    if (oldValue > newValue)
        return `{red-fg}${newValue.toFixed(pricePrecision[market])}{/}`
    else
        return `{green-fg}${newValue.toFixed(pricePrecision[market])}{/}`
}

function run() {

    portfolio.forEach((p) => {
        if (p.market !== 'EUR-EUR') {
            client.websocket.subscriptionTicker(p.market, updatePrice);
            client.websocket.subscriptionAccount(p.market, tradeBot.accountCallBack);
        }
    });

    setInterval(function () {
        if (running) {
            client.balance().then(balanceCallBack).catch((e) => {
                console.log(e);
            });
            totalWorth.balance = 0;
            portfolio.forEach((p) => {
                totalWorth.balance += (p.balance * (p.bestBid > 0 ? p.bestBid : p.lastPrice));
            });
        }
    }, 1000);
}

function initializeEmitters() {
    let emitter = client.getEmitter();

    if (running) {
        emitter.on('error', (response) => {
            console.log(response)
        });

        emitter.on('balance', (response) => {
            response.forEach((item) => {
                if (portfolio.hasOwnProperty(item.symbol + '-EUR')) {
                    portfolio[item.symbol + '-EUR'].balance = item.available;
                }
            });
        });
    }
}

function getPortfolio() {
    return this.portfolio;
}

module.exports = {
    init: init,
    client: api,
    portfolio: portfolio,
    totalWorth: totalWorth,
}