var debug   = require('debug');
var fs      = require('fs');
var google  = require('googleapis');
var async   = require('async');
var exec    = require('child_process').exec;
var request = require('request');
//debug functions for output
var dbg = {
  //MAIN OUTPUT
  m : debug('lovebox:main'),

  //THROWING FUNCTION
  t : debug('lovebox:throw'),
  th : function(err){
    this.t(err);
    throw err;
  },
  //INFO
  i: debug('lovebox:INFO'),
  //ERROR
  e: debug('lovebox:ERROR')
};

var Lovebox = function(){
  this.config = undefined;
  this.gclient = {};
  this.lovebox = undefined;
  this.mp3list = [];
};

// Method to read the config file.
// cfg is the path of the file and as to be json
// throw an error if the file doesn't exist or the JSON file
// has syntax errors
Lovebox.prototype.readConfig = function(cfgUrl){
  var self = this;
  if (cfgUrl === undefined || cfgUrl === '') {
    cfgUrl = 'config.json';
  }
  this.config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
  return true && this.config;
};

var requestCode = function(gc){
  gc.url = gc.oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: gc.scopes
  });
  gc.error_message = 'Please go to this url to authorize lovebox to read '+
                ' your mp3s\n ' + gc.url + '\nAfter set the app_code in '+
                ' config.json with the code retrieved and';
  dbg.i(gc.error_message);
  process.exit(0);
};
var saveParam = function(gc){
  fs.writeFileSync('gparam.json', JSON.stringify(gc.param, null, 4));
};
// Method to activate the GoogleAPI to access
// drive folder
Lovebox.prototype.gOAuth = function(onfinish){
  var gc = this.gclient;
  var config = this.config;
  gc.OAuth2 = google.auth.OAuth2;
  gc.param = JSON.parse(fs.readFileSync('gparam.json', 'utf8'));
  gc.oauth2Client = new gc.OAuth2(gc.param.client_id,
                             gc.param.client_secret,
                             gc.param.redirect_url);
  gc.scopes = [
    'https://www.googleapis.com/auth/drive'
  ];
  if (!gc.param.tokens || gc.param.tokens.expiry_date <= Math.floor(Date.now() / 1000)) {
    if(!this.config.app_code){
      requestCode(gc);
    } else {
      gc.oauth2Client.getToken(config.app_code, function(err, tokens) {
        // Now tokens contains an access_token and
        // an optional refresh_token. Save them.
        if(!err) {
          gc.param.tokens = tokens;
          saveParam(gc);
          google.options({ auth: gc.oauth2Client });
          gc.drive = google.drive({ version: 'v2', auth: gc.oauth2Client });
          onfinish();
        } else {
          dbg.m('ci sono problemi a chiedere il codice');
          dbg.e(err);
          requestCode(gc);
        }
      });
    }
  } else {
    gc.oauth2Client.setCredentials(gc.param.tokens);
    google.options({ auth: gc.oauth2Client });
    gc.drive = google.drive({ version: 'v2', auth: gc.oauth2Client });
    onfinish();
  }

};

// Function that start the lovebox daemon
Lovebox.prototype.init = function(cfgUrl,callback){
  //read the config if the readConfig function wasn't used before
  var gc = this.gclient;
  var self = this;

  if (this.config === undefined) {
    this.readConfig(cfgUrl);
  }
  this.gOAuth(function(){
    //looking for the folder and
    gc.drive.files.list({ q:'title="lovebox"' },function(err,response){
      if(err){
        dbg.i('Error Asking lovebox folder');
        dbg.e(err);

      } else {
        if(response.items.length === 1){
          //we found the folder
          self.lovebox = response.items[0];
          callback();
        } else {
          dbg.i('Please create a folder call "lovebox" on your GoogleDrive and' +
                ' fill it with your loved mp3s ');
          process.exit(0);
        }
      }
    });
  });
  //activate google API

};

Lovebox.prototype.retrieveMp3List = function(callback){
  var gc = this.gclient;
  var self = this;
  gc.drive.children.list({ folderId: this.lovebox.id}, function(err,response){
    if(!err){
      self.mp3list = response.items;
    } else{
      dbg.i('Error finding item in lovebox folder');
      dbg.e(err);
    }
    callback();
  });
};
Lovebox.prototype.playRandom = function(callback){
  var gc = this.gclient;
  var index = Math.floor(Math.random() * (this.mp3list.length - 1));
  gc.drive.files.get({ fileId: this.mp3list[index].id},function(e,r){
    request
      .get({uri:r.downloadUrl,headers:{authorization:'Bearer '+gc.param.tokens.access_token}})
      .on( 'response', function( res ){
        // extract filename
        var filename = regexp.exec( res.headers['content-disposition'] )[1];
        // create file write stream
        var fws = Fs.createWriteStream( 'mp3.mp3');
        // setup piping
        res.pipe( fws );
        res.on( 'end', function(){
          // go on with processing
          callback();
        });
      });
  });


};
var lb = new Lovebox();
async.series([
  function(c){
    lb.init('',c);
  }, function(c){
    lb.retrieveMp3List(c);
  },
  function(c){
    lb.playRandom(c);
  }
]);
