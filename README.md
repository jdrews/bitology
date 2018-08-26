# bitology
Realtime bitcoin transaction amount graph
http://jdrews.github.io/bitology/

Listens to transaction details from https://toshi.io/ and graphs transaction amounts over time. Written in JavaScript and uses d3.js for graphing.

## NOTE
toshi.io service was sunsetted on Dec 15th 2016 so this app won't work anymore as it remotely connected to the `wss://bitcoin.toshi.io/` service to receive bitcoin transactions. 
https://developers.coinbase.com/blog/2016/10/31/sunsetting-toshi
