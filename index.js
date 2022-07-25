require('dotenv').config()
let ui = require('./ui');
let bitvavo = require('./bitvavo-client');
let trade = require('./tradebot')

bitvavo.init(trade, ui);
ui.init(bitvavo, trade);
