let client;
let ui;
let portfolio = {};
let run = false;
let decimals = 3;
let config = {
    'DOT-EUR': {
        amount: 1,
        priceStep: 0.05,
        steps: 3,
    }
}

let openOrders = [];
let pause = false;

function init(c, p, u) {
    client = c;
    portfolio = p;
    ui = u;
    client.tickerPrice({}, (error, response) => {
        if (error !== null) {
            console.log(error);
        } else {
            response.forEach((currentPrice) => {
                const m = findPortfolio(currentPrice.market);
                if (m !== undefined) {
                    m.lastPrice = currentPrice.price;
                }
            });
        }

        client.ordersOpen({}, (error, response) => {
            if (error !== null) {
                console.log(error);
                return process.exit(1);
            }

            response.forEach((order) => openOrders.push(order));
            run = true;
        });

    });

    let needsCheck = true;
    setInterval(function () {
        if (run && !pause && needsCheck) {
            needsCheck = false;
            for (const [market, configuration] of Object.entries(config)) {
                initOrdersIfNeeded(market, configuration);
            }
        } else if (run && !pause) {
            client.ordersOpen({}, (error, response) => {
                if (error !== null) console.log(error);
                else {
                    response.forEach((order) => {
                        const o = openOrders.find((o) => o.orderId === order.orderId);
                        if (o === undefined) {
                            openOrders.push(order);
                        }
                    });
                }
            });

        }
    }, 1000);

    setInterval(() => {
        for (const [key, value] of Object.entries(config)) {
            client.getOrders(key, {limit: 1000}, (error, response) => {
                if (error === null) {
                    ui.profit[key] = 0;
                    response.forEach((order) => {
                        if (order.orderType === 'limit') {
                            const price = parseFloat(order.price) * parseFloat(order.amount) - parseFloat(order.feePaid);
                            if (order.status === 'filled') {
                                ui.profit[order.market] += order.side === 'sell' ? price : -price
                            } else if (order.side === 'buy' && ['new', 'open', 'partiallyFilled'].includes(order.status)) {
                                ui.profit[order.market] += -price
                            }
                        }
                    });
                }
            });
        }
    }, 10000)
}

function accountCallBack(rsp) {
    if (rsp.hasOwnProperty('status') && rsp.status === 'filled' && config.hasOwnProperty(rsp.market)) {
        const priceStep = config[rsp.market].priceStep;
        const priceOfOrder = parseFloat(rsp.price);
        if (rsp.side === 'buy') {
            placeOrder(rsp.market, 'sell', rsp.amount, (priceOfOrder + priceStep));
        } else {
            placeOrder(rsp.market, 'buy', rsp.amount, (priceOfOrder - priceStep));
        }
    }
}

function findPortfolio(market) {
    return portfolio.find((entry) => entry.market === market);
}

function initOrdersIfNeeded(market, configuration) {
    const o = openOrders.find((openOrder) => openOrder.market === market);
    // no open orders left
    if (o === undefined) {
        const m = findPortfolio(market);
        if (m !== undefined) {
            const price = parseFloat(m.lastPrice);
            if (price > 0) {
                for (let i = 1; i <= configuration.steps; i++) {
                    placeOrder(market, 'buy', configuration.amount, price - (configuration.priceStep * i));
                    placeOrder(market, 'sell', configuration.amount, price + (configuration.priceStep * i));
                }
            }
        }
    }
}

function placeOrder(market, side, amount, price) {
    // include fee so we don't lose anything
    price *= (side === 'buy' ? 0.9975 : 1.0025);
    client.placeOrder(market, side, 'limit', {amount: amount, price: price.toFixed(decimals)}, placeOrderCallBack);
}

function placeOrderCallBack(error, response) {
    if (error !== null) {
        console.log(error)
    }
}

module.exports = {
    init: init,
    open: openOrders,
    accountCallBack: accountCallBack,
}
