"use strict";
const express = require('express');
const request = require('request');
const Xray = require('x-ray');
const xray = Xray();
const _u = require('underscore');
const bodyParser = require('body-parser');
const Listing = require('./models/listing');
const mongoose = require('mongoose');
const db = mongoose.connection;
const Q = require('q');
const crypto = require('crypto');
const config = require('./config');
// const qs = require('qs');

mongoose.connect('mongodb://localhost/hestia');
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function(callback) {console.log('database open')});

let app = express();

app.use(bodyParser.json())

// cors to allow UI to hit this api
app.use((req, res, next) => {
  res.header("Accept", "application/json")
  res.header("Content-Type", "application/json")
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


var Options = function(uri, method, qs) {
  this.uri = uri
  this.method = method || 'GET'
  this.qs = qs
}


app.get('/', (req, res) => {
  var options = new Options('https://sfbay.craigslist.org/search/apa?search_distance=5&postal=94704&min_price=1700&max_price=2500&bedrooms=1&minSqft=600&availabilityMode=0&pets_cat=1')
  request(options, (error, response, body) => {
    console.log('ERROR', error);
    // console.log('BODY', body );


    var listingInfo = () => {
      var deferred = Q.defer();
      xray(body, { title: xray('.result-info', ['.result-title']), 
                  price: xray('.result-info', ['.result-price']),
                  size: xray('.result-info', ['.housing']),
                  hood: xray('.result-info', ['.result-hood']),
                  url: xray('.result-info', ['a.result-title@href'])
                }
        )((err, resultInfo) => {
          var results = _u.map(resultInfo, (val, key) => {return val});
          var zipResults = _u.zip.apply(null, results);
          var zipToObj = _u.map(zipResults, (listing) => {
            var listingObj = _u.object(['title', 'price', 'size', 'hood', 'url'], listing);
            var size = listingObj.size.replace(/\s/g, '');
            listingObj['size'] = size;
            listingObj['url'] = 'https://sfbay.craigslist.org' + listingObj.url;
            var checksum = crypto.createHash('md5').update(listingObj.title + listingObj.price ).digest('hex');
            listingObj['checksum'] = checksum;
            return listingObj;
          });

          if (err) {
            deferred.reject(err);
          }
          else {
            deferred.resolve(zipToObj);
          }
        })
      return deferred.promise;
    }


    async function getListingInfo () {
      var res = await listingInfo();
      // console.log('RES', res);
      return res
    }


    // async function queryChecksum (listing) {
    //   console.log('listing', listing);
    //   var deferred = Q.defer();
    //   var checksum = listing.checksum;
    //   Listing.findOne({'checksum': checksum}, (err, doc) => {
    //     console.log('ERR', err);
    //     console.log('LISITNG DOC', doc);
    //   });
    // }


    async function queryChecksum () {
      var listings = await getListingInfo();      
      console.log('listings', listings);
      _u.map(listings, (listing) => {
        console.log('listing', listing);
        // Listing.findOneAndUpdate({'checksum': listing.checksum}, {$set: listing}, {upsert: true}, (err, doc) => {
        //   console.log('ERR', err);
        //   console.log('DOC', doc);
        // });

        Listing.findOne({'checksum': listing.checksum}, (err, doc) => {
          console.log('err', err);
          console.log('doc', doc);
          if (err) {
            console.log('got an error');
          }
          else if (doc) {
            console.log('noop');
          }
          else {
            console.log('add the record', listing);
            listing.newListing = true
            Listing.findOneAndUpdate({'checksum': listing.checksum}, {$set: listing}, {upsert: true}, (err0, doc0) => {
              console.log('ADD ERR', err0);
              console.log('ADD DOC', doc0);
            });            
          }

        });

      });
    }

    queryChecksum();

    res.status(200).send('body');
  })
})


app.get('/new', (req, res) => {
  // Listing.update({'newListing': true}, {$set: {'newListing': false}}, {'multi': true}, (err, doc) => {
  //   console.log('err', err);
  //   console.log('doc', doc);
  // });

  Listing.find({'newListing': true}, (err, doc) => {
    console.log('ERR', err);
    console.log('Found new listing', doc);
    if (err) {
      console.log('err');
    }
    else {
      _u.map(doc, (elem) => {
        var queryString = {
          'apikey': config.apikey, 
          'subject': elem.title,
          'msgTo': 'jeremy.r.sandor@gmail.com',
          'from': 'info@latitudefourty.com',
          'template': 'New Listing',
          'merge_title': elem.title,
          'merge_price': elem.price,
          'merge_size': elem.size,
          'merge_hood': elem.hood,
          'merge_url': elem.url
        }
        var options = new Options('https://api.elasticemail.com/v2/email/send', 'GET', queryString)
        

        request(options, (error, response, body) => {
          console.log('ERROR', error);
          console.log('Body', body);
          if (err) {
            console.log(err);
          }
          else {
            console.log('CHECKSUM...', elem.checksum)
            Listing.update({'checksum': elem.checksum}, {$set: {'newListing': false}}, (err0, doc0) => {
              console.log('ERR0', err0);
              console.log('DOC0', doc0);
            });    
          }
        });
      });
    }
  });


  res.status(200).send('body');
});

// app.post('/foo', (req, res) => {
//   console.log('req.body', req.body);
//   res.send(403);
// })


// app.listen(8000, () => {
//   console.log('app listening on port 8000');
// })



var server = app.listen(config.port, config.base_url, function() {
  var port = server.address().port;
  var host = server.address().address;
  // console.log('process.env.NODE_ENV, process.env.HOST', process.env, process.env.HOST)
  // console.log('server', server.address())
  console.log('Hestia listening at:', host, port);
});

