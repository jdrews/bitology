(function () {
    bitology = {

        // path to websocket
        url: "wss://bitcoin.toshi.io",

        // websocket connection object
        connection: null,
        forceClose: false,

        // graph objects
        graph: null,
        area: null,
        data: [],
        txData: [],

        // graph parameters
        id: "#graph1",
        width: window.innerWidth-50,
        height: window.innerHeight-50,
        interpolation: "basis",
        x: null,
        y: null,
        yAxis: null,
        xAxis: null,
        xAxisTicks: [],

        init: function () {
            this.forceClose = false;
            this.buildGraph();
            this.createwebsocket();
//            size=50
//            while(size--) bitology.txData[size] = "";
            size=50
            while(size--) bitology.xAxisTicks[size] = size;
        },
        createwebsocket: function () {

            this.connection = new WebSocket(this.url);
            this.connection.onopen = this.onopen;
            this.connection.onclose = this.onclose;
            this.connection.onerror = this.onerror;
            this.connection.onmessage = this.onmessage;
        },
        closestream: function () {
            this.forceClose = true;
            this.connection.close()
        },
        onopen: function () {
            console.log('Websocket connected');

            clearInterval(window.ping_websocket_server);
            window.ping_websocket_server = setInterval(function () {
                if (bitology.connection.bufferedAmount == 0 && bitology.forceClose == false)
                    bitology.connection.send("Keep alive from client");
            }, 30000);

//      bitology.connection.send(JSON.stringify({ subscribe: 'blocks' }));
            bitology.connection.send(JSON.stringify({subscribe: 'transactions'}));
        },
        onclose: function () {
            console.log('Websocket connection closed');
            if (this.forceClose != true) {
                bitology.reconnectwebsocket();
            } else {
                console.log("user forced the websocket to close, not reopening...")
            }

        },
        onerror: function (error) {
            console.log('Websocket error detected');
        },
        onmessage: function (e) {
            var obj = JSON.parse(e.data);

            if (obj.subscription === 'transactions') {
                        bitology.ontransaction(obj.data);
            }

            if (obj.subscription === 'blocks') {
                bitology.onblock(obj.data);
            }


        },
        reconnectwebsocket: function () {
            setTimeout(function () {
                if (bitology.forceClose == false) {
                    // Connection has closed so try to reconnect every 5 seconds.
                    console.log('Trying to reconnect websocket...');
                    bitology.createwebsocket();
                }
            }, 5 * 1000);
        },
        onblock: function (obj) {
            var source = $("#block-template").html();
            var template = Handlebars.compile(source);
            var context = {
                hash: obj.hash,
                height: obj.height,
                num_tx: obj.transactions_count,
                timestamp: moment.utc(obj.time).format('YYYY-MM-DD HH:mm:ss UTC'),
                created_at: moment.utc(obj.created_at).format('YYYY-MM-DD HH:mm:ss UTC')
            };
            $(".stats_block").prepend(template(context));
            $('.stats_block .block:gt(5)').remove();
        },
        ontransaction: function (obj) {
            var context = {
                hash: obj.hash,
                size: obj.size,
                amount: obj.amount > 0 ? (obj.amount / 1e8).toFixed(8) : false,
                created_at: moment.utc(obj.created_at).format('YYYY-MM-DD HH:mm:ss UTC')
            };
            console.log('got transaction ' + JSON.stringify(context));
            if (bitology.data.length >= 50) {
                bitology.data.shift(); // remove the first element of the array
                bitology.txData.shift();
            }
            // update data (stores tx amounts)
            bitology.data.push(parseFloat(context.amount));

            // update txData (stores tx hash)
            bitology.txData.push(context.hash)

            // rebuild y axis based on new data ranges
            bitology.y = d3.scale.linear().domain([d3.min(bitology.data), d3.max(bitology.data)]).range([bitology.height, 0]);

            // rebuild y axis
            bitology.yAxis = d3.svg.axis()
                .scale(bitology.y)
                .orient("left");

            // rebuild x axis
            bitology.xAxis = d3.svg.axis()
                .scale(bitology.x)
                .tickValues(bitology.xAxisTicks)
                .tickFormat(function(d, i){
                    return bitology.txData[d] //"Year1 Year2, etc depending on the tick value - 0,1,2,3,4"
                });

            this.redrawGraph();
            //console.log(JSON.stringify(bitology.data))

        },
        redrawGraph: function () {
            // create a area object that represents the SVN area we're creating
            bitology.area = d3.svg.area()
                .x(function (d, i) {return bitology.x(i);})
                .y0(bitology.height)
                .y1(function (d) {return bitology.y(d);})
                .interpolate(bitology.interpolation);

            // update graph data
            bitology.graph.selectAll("path")
                .data([bitology.data]) // set the new data
                .attr("d", bitology.area); // apply the new data values

            // reapply yAxis
            bitology.graph.selectAll("g .y.axis")
                .call(bitology.yAxis)

            // reapply xAxis
            // TODO: Need to realign tx hash to area chart, it's off center
            bitology.graph.selectAll("g .x.axis")
                .call(bitology.xAxis)
                .selectAll("text")
                            .style("text-anchor", "end")
                            .attr("transform", "rotate(-65)" )
                            .on("click", function(d) {
                                window.open("https://www.blocktrail.com/BTC/tx/"+bitology.txData[d]);
                            });
        },
        buildGraph: function () {

            var margin = {top: 20, right: 20, bottom: 70, left: 50};
            bitology.width = bitology.width - margin.left - margin.right;
            bitology.height = bitology.height - margin.top - margin.bottom;

            bitology.graph = d3.select(bitology.id).append("svg")
                    .attr("width", bitology.width + margin.left + margin.right)
                    .attr("height", bitology.height + margin.top + margin.bottom)
                .append("g")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            // create an SVG element inside the #graph div that fills 100% of the div
            //bitology.graph = d3.select(bitology.id).append("svg:svg").attr("width", "100%").attr("height", "100%");

            // X scale will fit values from 0-48 within pixels 0-100
            bitology.x = d3.scale.linear().domain([0, 48]).range([-5, bitology.width]); // starting point is -5 so the first value doesn't show and slides off the edge as part of the transition

            // Build y scale to fit data (rescale with new data on update in redrawGraph function)
            bitology.y = d3.scale.linear().domain([d3.min(bitology.data), d3.max(bitology.data)]).range([bitology.height, 0]);

            // create a area object that represents the SVN area we're creating
            bitology.area = d3.svg.area()
                .x(function (d, i) {return bitology.x(i);})
                .y0(bitology.height)
                .y1(function (d) {return bitology.y(d);})
                .interpolate(bitology.interpolation);

            bitology.yAxis = d3.svg.axis()
                .scale(bitology.y)
                .orient("left");

            bitology.xAxis = d3.svg.axis()
                .scale(bitology.x)
                .tickValues(bitology.xAxisTicks)
                .tickFormat(function(d, i){
                    return bitology.txData[d] //"Year1 Year2, etc depending on the tick value - 0,1,2,3,4"
                });

            // display the area by appending an svg:path element with the data area we created above
            bitology.graph.append("path")
                .attr("d", bitology.area(bitology.data))
                .attr("class", "area")

            bitology.graph.append("g")
                .attr("class", "y axis")
                    .call(bitology.yAxis)
                .append("text")
                    .attr("transform", "rotate(-90)")
                    .attr("y", 6)
                    .attr("dy", ".71em")
                    .style("text-anchor", "end")
                    .text("Amount (BTC)");

            bitology.graph.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0," + bitology.height + ")")
                    .call(bitology.xAxis);
        }
    }
}());


// toshi transaction example for reference
//got transaction {
//  "hash": "b919db108565c6ba5ec29bee1c4f38941a4c99825c31b8c1ab97af752134ca86",
//  "version": 1,
//  "lock_time": 0,
//  "size": 555,
//  "inputs": [
//    {
//      "previous_transaction_hash": "3b799aff62a70b9a99b4502368314822870154d091a6cb696ea23b8ff34317fb",
//      "output_index": 1,
//      "amount": 225209,
//      "script": "3045022100d51bea7dc68973e7296f76e98b0769756b4df96b084a0a58f9651aa9ec360483022036dd4a9595311171f4e90d28b928c10b859473030408eae0269c1d5f6f6b97bb01 02cc9a6cfff549b40e5e20941c8713a8d00094af484b2bf702e02bf92387b3b8f5",
//      "addresses": [
//        "12za8sXANVHKBSTbrpNwwGGCKcPRWbYF52"
//      ]
//    },
//    {
//      "previous_transaction_hash": "5bde3935caa3ebf4429f3eba490335eb9ff7c2c988a8949003ca00e74139f098",
//      "output_index": 1,
//      "amount": 129805,
//      "script": "3045022100dd24646c9fb0be47f3cc54a1b2c101828c07854271b7a2469a62014441c15cc40220556e16cca91bf7e4effa1cffc0cd699836906bf4131fabe6bdcd6ce29f1ab80e01 02fb27af6e8a6ee2c1522c7a52a2fda0de50b7ebe56820f989b4ba31c89f3b0003",
//      "addresses": [
//        "1F8vFbYHXD5gKS4gV6vq8mQGGU4otTRGr"
//      ]
//    },
//    {
//      "previous_transaction_hash": "8f4c0c837a9322ca6091e30ea468fb5c81f049266ff32ded9c4d1ca449454ce1",
//      "output_index": 1,
//      "amount": 120821,
//      "script": "304402207848ea4a2bc7b32433a941fc53baeeacadf53e591ac91af2b4f73625f28e7e32022006a6bc3414a7127210e06db4cf766a21d0e29775c43eb27f1198d4d59e53d20a01 02de04a87f2a18e543c850f6003063a6b7470ecdf8ff25c7c2477c0364915edebc",
//      "addresses": [
//        "1Q9UZnQcewz3Mov5msWBNBF2aaE8Etn9sj"
//      ]
//    }
//  ],
//  "outputs": [
//    {
//      "amount": 310000,
//      "spent": false,
//      "script": "OP_DUP OP_HASH160 7a4e3b960afbf95600c321b76f2f1c283a96c900 OP_EQUALVERIFY OP_CHECKSIG",
//      "script_hex": "76a9147a4e3b960afbf95600c321b76f2f1c283a96c90088ac",
//      "script_type": "hash160",
//      "addresses": [
//        "1C9hA7RDY3CGuZjnRyzfvxa7Sxwm87aPBC"
//      ]
//    },
//    {
//      "amount": 45014,
//      "spent": false,
//      "script": "OP_DUP OP_HASH160 0bc46602178c0d99e2c5ce4447c787107a239725 OP_EQUALVERIFY OP_CHECKSIG",
//      "script_hex": "76a9140bc46602178c0d99e2c5ce4447c787107a23972588ac",
//      "script_type": "hash160",
//      "addresses": [
//        "125Di7fvtMqjtgcy2Di8omY7ZbP9xPiWrd"
//      ]
//    },
//    {
//      "amount": 110821,
//      "spent": false,
//      "script": "OP_DUP OP_HASH160 8bd2af763d9d9746583d7cf2af85b2ae4212a913 OP_EQUALVERIFY OP_CHECKSIG",
//      "script_hex": "76a9148bd2af763d9d9746583d7cf2af85b2ae4212a91388ac",
//      "script_type": "hash160",
//      "addresses": [
//        "1DkKKLsDAoSEpbsZWdEcks2CFo78HZtWEi"
//      ]
//    }
//  ],
//  "amount": 465835,
//  "fees": 10000,
//  "confirmations": 0,
//  "pool": "memory"
//}
