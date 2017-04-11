var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var listingSchema = new Schema({
  checksum: String,
  title: String,
  price: String,
  size: String,
  hood: String,
  url: String,
  newListing: {type: Boolean, default: true}
});

var Listing = mongoose.model('Listing', listingSchema);

module.exports = Listing;