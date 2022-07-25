let blessed = require('blessed');

let screen = blessed.screen({smartCSR: true});
let client;
let trade;
let portfolioTable = blessed.table({tags: true, top: 2, left: 50, pad: 1, scrollable: false,});
let ordersTable = blessed.table({tags: true, top: 2, right: 5, pad: 1, scrollable: false,});
let profitTable = blessed.table({tags: true, top: 40, right: 5, pad: 1, scrollable: false,});
let totalStr = blessed.text({top: 40, left: 50});
let profit = {};

function init(bitvavo, tradeBot) {
    client = bitvavo;
    trade = tradeBot;
    screen.key(['escape'], function (ch, key) {
        return process.exit(0);
    });
    screen.key(['c'], function (ch, key) {
        tradeBot.cancelOrder();
    });
    initGUIElements();

    setInterval(function () {
        render();
    }, 100);
}

function initGUIElements() {
    screen.append(portfolioTable);
    screen.append(ordersTable);
    screen.append(profitTable);
    screen.append(totalStr);
}

function render() {
    renderPortfolio();
    renderTrades();
    renderProfit();
    screen.render();
}

function renderTrades() {
    let data = [];
    data.push(['market', 'id', 'side', 'amount', 'remaining', 'price', 'status']);
    trade.open.forEach((o) => {
        data.push([o.market, o.orderId, o.side, o.amount, o.amountRemaining, o.price, o.status]);
    });
    ordersTable.setData(data);
}

function renderProfit() {
    let data = [];
    data.push(['market', 'profit']);
    for (const [key, value] of Object.entries(profit)) {
        data.push([key, value.toFixed(2)]);
    }
    profitTable.setData(data);
}

function renderPortfolio() {
    if (client.portfolio !== undefined) {
        let data = []
        data.push(['market', 'portfolio balance', 'worth', 'lastPrice', 'ask price', 'bid price'])
        client.portfolio.forEach((p) => {
            if (p.balance > 0) {
                data.push([
                    p.market,
                    p.balance,
                    p.balanceEuro,
                    p.lastPrice,
                    p.bestAsk,
                    p.bestBid,
                ]);
            }
        });
        portfolioTable.setData(data);
        totalStr.content = 'portfolio total: ' + (client.totalWorth.balance.toFixed(2)).toString();
    }
}

module.exports = {
    init: init,
    profit: profit,
}