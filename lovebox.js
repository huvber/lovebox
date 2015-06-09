var debug   = require('debug');
var fs      = require('fs');
var os      = require('os');
var async   = require('async');
var cp    = require('child_process');
var ddpi    = require('./server');
var ison    = require('is-online');

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
  this.lovebox = undefined;
  this.ddp = undefined;
  this.isPlaying = false;
  this.currentTrack = '';
  this.musicChild = undefined;
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
Lovebox.prototype.connect2Wifi = function(){
  var wifi = this.config.wifi;
  for(var i in wifi){
    for(var nif in os.networkInterfaces()){

    }
  }
};
var checkIsOnline = function(ison,isoff){
  ison(function(err,online){
    if(online){
      ison();
    }else{
      isoff();
      setTimeout(function(){
        checkIsOnline(ison,isoff);
      },3000);
    }
  });
};
var downloadMp3 = function(config,mp3){
  var exec = require('child_process').exec;
  var url = '\'http://' + config.server.host + ':' + config.server.port + mp3.url+'\'';
  if (!fs.existsSync('mp3s/' + mp3.filename)) {
    child = exec('wget -P mp3s/ \'' + url + '\'',
      function(error, stdout, stderr) {
          if (error !== null)
            dbg.e(error);
        });
  }
};
Lovebox.prototype.resetMp3 = function(handler){
  var files = fs.readdirSync('./mp3s');
  for (var f in files){
    fs.unlinkSync('./mp3s/'+ files[f]);
  }
  if(handler !== undefined) handler();
};
Lovebox.prototype.playMusic = function(handler){
  var files = fs.readdirSync('./mp3s');
  var ran = Math.floor(Math.random() * files.length);
  var self = this;
  dbg.m('Playing: ' + files[ran]);
  if(this.lovebox !== undefined){
    this.lovebox.state = 'playing: ' + files[ran];
    this.ddp.changeLovebox(this.lovebox,function(err,res){

    });
  }

  this.currentTrack = files[ran];
  this.musicChild = cp.spawn('mplayer',['./mp3s/'+files[ran]]);
  this.musicChild.on('close',function(code,signal){
    dbg.i('close '+ signal);
    if(signal !== 'SIGKILL')
      self.playMusic();
  });
  if(handler !== undefined) handler();
};
Lovebox.prototype.stopPlaying = function(){
  dbg.i('stop music');
  this.musicChild.kill('SIGKILL');
};


Lovebox.prototype.start = function(){
  //check if is connected
  var self = this;
  checkIsOnline(function(){
    //if is online
    dbg.m('connected');
    self.resetMp3(function(){
      self.ddp.connect();
    });
  },function(){
    dbg.m('not connected');
    //if is off
  });
  self.playMusic();
};

// Function that start the lovebox daemon
Lovebox.prototype.init = function(cfgUrl){
  if (cfgUrl === undefined || cfgUrl === '') {
    cfgUrl = 'config.json';
  }
  if(this.config === undefined )
    this.readConfig(cfgUrl);
  //read the config if the readConfig function wasn't used before
  var self = this;
  this.ddp = new ddpi({
    config: this.config,
    onGetLovebox: function(lovebox,mp3s){
      dbg.m('get lovebox');
      self.lovebox = lovebox;
      for(var i in mp3s){
        downloadMp3(self.config,mp3s[i]);
      }
      //store wifi setup on config
      self.config.wifi = lovebox.wifi;
      fs.writeFileSync('config.json', JSON.stringify(self.config, null, 4));
    },
    onLoveboxChange: function(lovebox,oldfields){
      dbg.m('change lovebox');
      self.lovebox = lovebox;
      //store wifi setup on config
      self.config.wifi = lovebox.wifi;
      fs.writeFileSync('config.json', JSON.stringify(self.config, null, 4));

      //check state changed
      //CHANGE STATE
      if(lovebox.state.search('stop')!== -1){
        self.stopPlaying();
        return;
      }
      if(lovebox.state.search('next')!== -1){
        self.stopPlaying();
        self.playMusic();
        return;
      }

    },
    onMp3Added: function(mp3){
      //save MP3
      dbg.m(mp3);
      downloadMp3(mp3);

    },
    onMp3Removed: function(oldValue){
      //check if the mp3 is running

      //remove MP3

    },
    onDisconnection: function(code,message){
      dbg.e('Disconnection code:' +code);
      dbg.e(message);
      //try to reconnect with wifi


    },
    onConnectionError: function(error){
      dbg.e(error);
      //try to reconnect with wifi
    }
  });
};

module.exports = Lovebox;
