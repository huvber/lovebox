var deb = require('debug')('debug:server');
var log = require('debug')('debug:server-msg');
var DDPClient = require('ddp');
var DDPLogin = require('ddp-login');
var _ = require('underscore');
var async = require('async');

function Server(data) {
  this.config = data.config;
  this.token = null;
  this.lovebox = null;
  this.ddp = new DDPClient({
    host: this.config.server.host,
    port: this.config.server.port,
    autoReconnect: true,
    autoReconnectTimer: 500,
    maintainCollections: true,
    useSockJs: true
  });
  log('DDP Client initialized');
  this.data = data;

  this.ddp.on('message', function(msg) {
    //deb('ddp message: ' + msg);
  });
  this.ddp.on('socket-close', function(code, message) {
    //deb('Close: %s %s', code, message);
  });
  this.ddp.on('socket-error', function(error) {
    //deb('Error: %j', error);
  });
}


Server.prototype.connect = function(func) {
  log('DDPClient connection start');
  var ddp = this.ddp;
  var config = this.config;
  var data = this.data;
  var srv = this;
  var token = this.token;

  async.series([
    function(c){
      //connect;
      ddp.connect(function(err, wrec) {
        log('connection');
        if (err)
          log('connection error' + err);
        else
          log('connected');
        c(err,null);
      });
    },
    function(c){
      //login
      DDPLogin.loginWithEmail(ddp, config.server.user, config.server.passwd, function (err, userInfo) {
        if (err)
          log('login Error');
        else{
          log('logged');
          token = userInfo.token;
        }
        c(err,null);
      });
    },
    function(c){
      //subscription and observation
      ddp.subscribe('loveboxes');
      ddp.subscribe('mp3s');

      var obsLoveboxes =  ddp.observe('loveboxes');
      obsLoveboxes.changed = function(idL, oldFields, clearedFields, newFields) {
        if (idL === config.loveboxId) {
          _.extend(srv.lovebox, newFields);

          if (data.onLoveboxChange !== undefined) data.onLoveboxChange(srv.lovebox, oldFields);
        }
      };

      var obsMp3s = ddp.observe('mp3s');
      obsMp3s.added = function(id) {
        mp3 = ddp.collections.mp3s.find(id);
        console.log(mp3);
        if (config.loveboxId === mp3.lovebox) {
          if (data.onMp3Added !== undefined) data.onMp3Added(mp3);
        }
      };
      obsMp3s.removed = function(id, oldValue) {
        if (data.onMp3Removed !== undefined) data.onMp3Removed(oldValue);
      };
      c();
    },
    function(c){
      //retrieve lovebox
      log('getting loveBox...');
      ddp.call('getLovebox', [config.loveboxId], function(err, res) {
        if (err)
          log('getLovebox' + err);
        else {
          srv.lovebox = res;
          ddp.call('mp3List',[config.loveboxId],function(err,res){
            if(err)
              log('getList error' + err);
            else if (data.onGetLovebox !== undefined) data.onGetLovebox(srv.lovebox,res);
            c(err,null);
          });
        }
      });
    },

  ],function c(err,data){
    if(err) log(err);
  });

  ddp.on('socket-close', function(code, message) {
    data.onDisconnection(code,message);
  });

  ddp.on('socket-error', function(error) {
    data.onConnetionError(error);
  });
  if(func !== undefined) func();
};

Server.prototype.changeLovebox = function(lovebox,handler){
  this.ddp.call('loveboxChangeState',[lovebox],handler);
};
module.exports = Server;
